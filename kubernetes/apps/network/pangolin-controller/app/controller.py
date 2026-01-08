#!/usr/bin/env python3
"""
Pangolin Blueprint Controller

Watches Kubernetes resources (HTTPRoutes, Ingresses, etc.) with specific labels
and automatically creates/updates Pangolin blueprints for authentication.

Similar to how external-dns creates DNS records or cert-manager creates certificates.
"""

import os
import sys
import time
import json
import logging
import requests
from typing import Dict, List, Optional, Any
from kubernetes import client, config, watch
from kubernetes.client.rest import ApiException
import urllib3

# Suppress SSL warnings for Pangolin API calls
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('pangolin-controller')


class PangolinBlueprintController:
    """Controller that syncs Kubernetes resources to Pangolin blueprints"""

    # Label/annotation keys
    LABEL_MANAGED = "pangolin.io/managed"
    LABEL_BLUEPRINT = "pangolin.io/blueprint"
    ANNOTATION_ORG = "pangolin.io/organization"
    ANNOTATION_SITE = "pangolin.io/site"
    ANNOTATION_AUTH_TYPE = "pangolin.io/auth-type"  # oauth2, basic, etc.
    ANNOTATION_PUBLIC = "pangolin.io/public"  # true/false

    def __init__(self):
        """Initialize the controller with Kubernetes and Pangolin clients"""
        # Load Kubernetes config
        try:
            config.load_incluster_config()
            logger.info("Loaded in-cluster Kubernetes config")
        except:
            config.load_kube_config()
            logger.info("Loaded local Kubernetes config")

        # Initialize Kubernetes clients
        self.v1 = client.CoreV1Api()
        self.custom_api = client.CustomObjectsApi()
        self.networking_v1 = client.NetworkingV1Api()

        # Load Pangolin configuration from environment
        self.pangolin_endpoint = os.environ.get('PANGOLIN_ENDPOINT', '').rstrip('/')
        self.pangolin_api_key = os.environ.get('PANGOLIN_API_KEY', '')
        self.organization = os.environ.get('PANGOLIN_ORGANIZATION', 'homelab')
        self.default_site = os.environ.get('PANGOLIN_SITE', 'newt-home-cluster')

        if not self.pangolin_endpoint or not self.pangolin_api_key:
            logger.error("PANGOLIN_ENDPOINT and PANGOLIN_API_KEY must be set")
            sys.exit(1)

        logger.info(f"Pangolin endpoint: {self.pangolin_endpoint}")
        logger.info(f"Default organization: {self.organization}")
        logger.info(f"Default site: {self.default_site}")

        # Track managed blueprints
        self.managed_blueprints: Dict[str, str] = {}  # resource_key -> blueprint_id

    def get_pangolin_headers(self) -> Dict[str, str]:
        """Get headers for Pangolin API requests"""
        return {
            'X-API-Key': self.pangolin_api_key,
            'Content-Type': 'application/json'
        }

    def extract_blueprint_config(self, resource: Dict[str, Any], kind: str) -> Optional[Dict[str, Any]]:
        """Extract blueprint configuration from a Kubernetes resource"""
        metadata = resource.get('metadata', {})
        spec = resource.get('spec', {})

        # Check if resource should be managed
        labels = metadata.get('labels', {})
        if labels.get(self.LABEL_MANAGED) != 'true':
            return None

        annotations = metadata.get('annotations', {})
        name = metadata.get('name')
        namespace = metadata.get('namespace', 'default')

        # Build blueprint configuration
        blueprint_config = {
            'name': f"{namespace}-{name}",
            'organization': annotations.get(self.ANNOTATION_ORG, self.organization),
            'site': annotations.get(self.ANNOTATION_SITE, self.default_site),
            'auth_type': annotations.get(self.ANNOTATION_AUTH_TYPE, 'oauth2'),
            'public': annotations.get(self.ANNOTATION_PUBLIC, 'false').lower() == 'true',
            'metadata': {
                'kubernetes_resource': f"{kind}/{namespace}/{name}",
                'managed_by': 'pangolin-controller'
            }
        }

        # Extract hostnames and paths based on resource type
        if kind == 'HTTPRoute':
            blueprint_config['hostnames'] = self.extract_httproute_hostnames(spec)
            blueprint_config['paths'] = self.extract_httproute_paths(spec)
        elif kind == 'Ingress':
            blueprint_config['hostnames'] = self.extract_ingress_hostnames(spec)
            blueprint_config['paths'] = self.extract_ingress_paths(spec)

        # Use custom blueprint name if specified
        if self.LABEL_BLUEPRINT in labels:
            blueprint_config['name'] = labels[self.LABEL_BLUEPRINT]

        return blueprint_config

    def extract_httproute_hostnames(self, spec: Dict) -> List[str]:
        """Extract hostnames from HTTPRoute spec"""
        hostnames = []
        for hostname in spec.get('hostnames', []):
            if hostname and not hostname.startswith('*'):
                hostnames.append(hostname)
        return hostnames

    def extract_httproute_paths(self, spec: Dict) -> List[str]:
        """Extract paths from HTTPRoute spec"""
        paths = []
        for rule in spec.get('rules', []):
            for match in rule.get('matches', []):
                if 'path' in match:
                    path_value = match['path'].get('value', '/')
                    paths.append(path_value)
        return paths if paths else ['/']

    def extract_ingress_hostnames(self, spec: Dict) -> List[str]:
        """Extract hostnames from Ingress spec"""
        hostnames = []
        for rule in spec.get('rules', []):
            if 'host' in rule:
                hostnames.append(rule['host'])
        return hostnames

    def extract_ingress_paths(self, spec: Dict) -> List[str]:
        """Extract paths from Ingress spec"""
        paths = []
        for rule in spec.get('rules', []):
            if 'http' in rule:
                for path in rule['http'].get('paths', []):
                    paths.append(path.get('path', '/'))
        return paths if paths else ['/']

    def create_or_update_blueprint(self, config: Dict[str, Any]) -> Optional[str]:
        """Create or update a blueprint in Pangolin"""
        resource_key = config['metadata']['kubernetes_resource']

        try:
            # Check if blueprint already exists
            if resource_key in self.managed_blueprints:
                blueprint_id = self.managed_blueprints[resource_key]
                return self.update_blueprint(blueprint_id, config)
            else:
                return self.create_blueprint(config)
        except Exception as e:
            logger.error(f"Failed to create/update blueprint for {resource_key}: {e}")
            return None

    def create_blueprint(self, config: Dict[str, Any]) -> Optional[str]:
        """Create a new blueprint in Pangolin"""
        # Prepare blueprint payload
        payload = {
            'name': config['name'],
            'type': 'proxy',  # or 'forward' based on config
            'organizationId': self.get_organization_id(config['organization']),
            'siteId': self.get_site_id(config['site']),
            'config': {
                'hostnames': config.get('hostnames', []),
                'paths': config.get('paths', ['/']),
                'authType': config['auth_type'],
                'public': config['public']
            },
            'metadata': config['metadata']
        }

        response = requests.post(
            f"{self.pangolin_endpoint}/v1/blueprints",
            json=payload,
            headers=self.get_pangolin_headers(),
            verify=False
        )

        if response.status_code == 201:
            blueprint_id = response.json().get('id')
            resource_key = config['metadata']['kubernetes_resource']
            self.managed_blueprints[resource_key] = blueprint_id
            logger.info(f"Created blueprint {config['name']} (ID: {blueprint_id})")
            return blueprint_id
        else:
            logger.error(f"Failed to create blueprint: {response.status_code} - {response.text}")
            return None

    def update_blueprint(self, blueprint_id: str, config: Dict[str, Any]) -> Optional[str]:
        """Update an existing blueprint in Pangolin"""
        # Prepare update payload
        payload = {
            'name': config['name'],
            'config': {
                'hostnames': config.get('hostnames', []),
                'paths': config.get('paths', ['/']),
                'authType': config['auth_type'],
                'public': config['public']
            },
            'metadata': config['metadata']
        }

        response = requests.patch(
            f"{self.pangolin_endpoint}/v1/blueprints/{blueprint_id}",
            json=payload,
            headers=self.get_pangolin_headers(),
            verify=False
        )

        if response.status_code == 200:
            logger.info(f"Updated blueprint {config['name']} (ID: {blueprint_id})")
            return blueprint_id
        else:
            logger.error(f"Failed to update blueprint: {response.status_code} - {response.text}")
            return None

    def delete_blueprint(self, resource_key: str):
        """Delete a blueprint from Pangolin"""
        if resource_key not in self.managed_blueprints:
            return

        blueprint_id = self.managed_blueprints[resource_key]
        response = requests.delete(
            f"{self.pangolin_endpoint}/v1/blueprints/{blueprint_id}",
            headers=self.get_pangolin_headers(),
            verify=False
        )

        if response.status_code in [200, 204]:
            logger.info(f"Deleted blueprint {blueprint_id} for {resource_key}")
            del self.managed_blueprints[resource_key]
        else:
            logger.error(f"Failed to delete blueprint: {response.status_code} - {response.text}")

    def get_organization_id(self, org_name: str) -> str:
        """Get organization ID from name (implement caching)"""
        # TODO: Implement API call to get org ID
        # For now, return a placeholder
        return org_name

    def get_site_id(self, site_name: str) -> str:
        """Get site ID from name (implement caching)"""
        # TODO: Implement API call to get site ID
        # For now, return a placeholder
        return site_name

    def watch_httproutes(self):
        """Watch HTTPRoute resources for changes"""
        w = watch.Watch()
        try:
            # Watch all HTTPRoutes across all namespaces
            for event in w.stream(
                self.custom_api.list_cluster_custom_object,
                group="gateway.networking.k8s.io",
                version="v1beta1",
                plural="httproutes"
            ):
                event_type = event['type']
                httproute = event['object']

                logger.debug(f"HTTPRoute event: {event_type} - {httproute['metadata']['name']}")

                config = self.extract_blueprint_config(httproute, 'HTTPRoute')
                if not config:
                    continue

                if event_type in ['ADDED', 'MODIFIED']:
                    self.create_or_update_blueprint(config)
                elif event_type == 'DELETED':
                    resource_key = f"HTTPRoute/{httproute['metadata']['namespace']}/{httproute['metadata']['name']}"
                    self.delete_blueprint(resource_key)
        except ApiException as e:
            if e.status == 404:
                logger.warning("HTTPRoute CRD not found, skipping HTTPRoute watch")
            else:
                logger.error(f"Error watching HTTPRoutes: {e}")

    def watch_ingresses(self):
        """Watch Ingress resources for changes"""
        w = watch.Watch()
        try:
            # Watch all Ingresses across all namespaces
            for event in w.stream(self.networking_v1.list_ingress_for_all_namespaces):
                event_type = event['type']
                ingress = event['object']

                logger.debug(f"Ingress event: {event_type} - {ingress.metadata.name}")

                # Convert to dict for processing
                ingress_dict = client.ApiClient().sanitize_for_serialization(ingress)
                config = self.extract_blueprint_config(ingress_dict, 'Ingress')
                if not config:
                    continue

                if event_type in ['ADDED', 'MODIFIED']:
                    self.create_or_update_blueprint(config)
                elif event_type == 'DELETED':
                    resource_key = f"Ingress/{ingress.metadata.namespace}/{ingress.metadata.name}"
                    self.delete_blueprint(resource_key)
        except Exception as e:
            logger.error(f"Error watching Ingresses: {e}")

    def run(self):
        """Main controller loop"""
        logger.info("Starting Pangolin Blueprint Controller")

        # Start watching resources in parallel
        import threading

        httproute_thread = threading.Thread(target=self.watch_httproutes, daemon=True)
        ingress_thread = threading.Thread(target=self.watch_ingresses, daemon=True)

        httproute_thread.start()
        ingress_thread.start()

        # Keep the main thread alive
        try:
            while True:
                time.sleep(30)
                logger.debug(f"Controller running, managing {len(self.managed_blueprints)} blueprints")
        except KeyboardInterrupt:
            logger.info("Shutting down controller")


if __name__ == '__main__':
    controller = PangolinBlueprintController()
    controller.run()