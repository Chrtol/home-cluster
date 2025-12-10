from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    oidc_client_id: str
    oidc_client_secret: str
    oidc_discovery_url: str
    oidc_redirect_uri: str
    webhook_url: str | None = None
    frontend_url: str

    # Security settings
    environment: str = "production"  # development, staging, production
    access_token_expire_minutes: int = 1440  # 24 hours (balances security and UX)
    refresh_token_expire_days: int = 7
    sql_echo: bool = False  # Only enable in development

    # Cookie settings for secure token storage
    cookie_secure: bool = True  # Require HTTPS
    cookie_httponly: bool = True  # Prevent XSS access
    cookie_samesite: str = "lax"  # CSRF protection
    cookie_domain: str | None = None

    # Schedule instance generation settings
    instance_generation_days_ahead: int = 60  # How many days ahead to generate schedule instances

    # Photo storage settings
    photo_storage_backend: str = "local"  # Options: local, s3, nfs, hybrid
    local_storage_path: str = "/app/photos"

    # S3 storage settings (for S3 or hybrid backends)
    s3_endpoint: str | None = None
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_bucket: str = "reptile-photos"
    s3_region: str = "us-east-1"

    # NFS storage settings (for NFS or hybrid backends)
    nfs_mount_path: str = "/mnt/nas-photos"

    # Hybrid storage settings
    hybrid_fullsize_backend: str = "s3"  # Options: s3, nfs

    # Image processing settings
    max_photo_size_mb: int = 10
    max_photo_width: int = 4000  # Allow larger photos for better quality
    jpeg_quality: int = 95  # High quality JPEG compression
    thumbnail_longest_side: int = 1200  # Gallery thumbnails: longest side in pixels (maintains aspect ratio)

    # Photo limits
    max_photos_per_log: int = 3
    allow_caretaker_delete_others: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
