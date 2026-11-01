#!/usr/bin/env python3
"""Write JSON schemas for the cluster's built-in types (Deployment, ConfigMap, ...)
from the API server's OpenAPI v3, in the {group}/{kind}_{version}.json layout the
CRD extractor uses. Files that already exist are left alone, so CRD schemas
extracted from their CRD manifests win over the API server's copy."""

import copy
import json
import subprocess
import sys
from pathlib import Path

REF_PREFIX = "#/components/schemas/"


def kubectl_raw(path):
    out = subprocess.run(["kubectl", "get", "--raw", path], check=True, capture_output=True)
    return json.loads(out.stdout)


def rewrite_refs(node, found):
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith(REF_PREFIX):
            name = ref[len(REF_PREFIX):]
            found.add(name)
            node["$ref"] = "#/definitions/" + name
        for value in node.values():
            rewrite_refs(value, found)
    elif isinstance(node, list):
        for value in node:
            rewrite_refs(value, found)


def make_strict(schema):
    # Walks schema positions only: a "properties" map holds field names, and a
    # field can itself be called "properties" (JSONSchemaProps has one).
    if not isinstance(schema, dict):
        return
    props = schema.get("properties")
    if isinstance(props, dict):
        if "additionalProperties" not in schema and not schema.get("x-kubernetes-preserve-unknown-fields"):
            schema["additionalProperties"] = False
        for sub in props.values():
            make_strict(sub)
    for key in ("items", "additionalProperties", "not"):
        make_strict(schema.get(key))
    for key in ("allOf", "anyOf", "oneOf"):
        for sub in schema.get(key) or []:
            make_strict(sub)


def build(root_name, components):
    root = copy.deepcopy(components[root_name])
    definitions = {}
    pending = set()
    rewrite_refs(root, pending)
    while pending:
        name = pending.pop()
        if name in definitions or name not in components:
            continue
        definition = copy.deepcopy(components[name])
        found = set()
        rewrite_refs(definition, found)
        definitions[name] = definition
        pending |= found - definitions.keys()
    make_strict(root)
    # SOPS-encrypted manifests carry this key on disk; Flux strips it on decrypt.
    root.setdefault("properties", {})["sops"] = {"type": "object"}
    for definition in definitions.values():
        make_strict(definition)
    schema = {"$schema": "http://json-schema.org/draft-07/schema#", **root}
    if definitions:
        schema["definitions"] = definitions
    return schema


def main(out_dir):
    out = Path(out_dir)
    written = 0
    for path, entry in sorted(kubectl_raw("/openapi/v3")["paths"].items()):
        if path == "api/v1":
            group, version = "", "v1"
        elif path.startswith("apis/") and path.count("/") == 2:
            _, group, version = path.split("/")
        else:
            continue
        components = kubectl_raw(entry["serverRelativeURL"]).get("components", {}).get("schemas", {})
        for name, component in components.items():
            for gvk in component.get("x-kubernetes-group-version-kind", []):
                if (gvk["group"], gvk["version"]) != (group, version):
                    continue
                target = out / (gvk["group"] or "core") / f"{gvk['kind'].lower()}_{gvk['version'].lower()}.json"
                if target.exists():
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(json.dumps(build(name, components), indent=2) + "\n")
                written += 1
    print(f"wrote {written} built-in schemas to {out}")


if __name__ == "__main__":
    main(sys.argv[1])
