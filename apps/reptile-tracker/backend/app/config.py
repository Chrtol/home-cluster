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

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
