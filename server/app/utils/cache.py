import redis
from typing import Optional
import json
from ..config import settings

class Cache:
    def __init__(self):
        self.redis = redis.from_url(settings.REDIS_URL)

    async def get(self, key: str) -> Optional[str]:
        try:
            value = self.redis.get(key)
            if value:
                return value.decode('utf-8')
            return None
        except:
            return None

    async def set(self, key: str, value: str, expire: int = None) -> bool:
        try:
            if expire is None:
                expire = settings.CACHE_EXPIRE
            return self.redis.set(key, value, ex=expire)
        except:
            return False

    async def delete(self, key: str) -> bool:
        try:
            return self.redis.delete(key) > 0
        except:
            return False
