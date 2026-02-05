from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/nw_validation"
    database_url_sync: str = "postgresql://user:password@localhost:5432/nw_validation"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    encryption_key: str = ""
    validation_batch_size: int = 50
    validation_context_turns: int = 2
    validation_max_items_per_request: int = 100


@lru_cache
def get_settings() -> Settings:
    return Settings()
