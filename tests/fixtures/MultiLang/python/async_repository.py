# Python: Async repository using SQLAlchemy 2.x
# Paradigm: Async/await, generic repository pattern, ORM
from __future__ import annotations

from typing import Generic, TypeVar, Optional, List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, func as sa_func
from sqlalchemy.orm import DeclarativeBase

T = TypeVar("T")


class AsyncRepository(Generic[T]):
    """Generic async CRUD repository backed by SQLAlchemy AsyncSession."""

    def __init__(self, model: type[T], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def get_by_id(self, record_id: int | str) -> Optional[T]:
        result = await self.session.execute(
            select(self.model).where(self.model.id == record_id)  # type: ignore[attr-defined]
        )
        return result.scalar_one_or_none()

    async def find_all(self, **filters: Any) -> List[T]:
        query = select(self.model)
        for attr, value in filters.items():
            query = query.where(getattr(self.model, attr) == value)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def save(self, entity: T) -> T:
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)  # type: ignore[arg-type]
        return entity

    async def save_many(self, entities: List[T]) -> List[T]:
        for e in entities:
            self.session.add(e)
        await self.session.flush()
        return entities

    async def update_by_id(self, record_id: int | str, **values: Any) -> int:
        result = await self.session.execute(
            update(self.model)
            .where(self.model.id == record_id)  # type: ignore[attr-defined]
            .values(**values)
        )
        return result.rowcount  # type: ignore[union-attr]

    async def delete_by_id(self, record_id: int | str) -> int:
        result = await self.session.execute(
            delete(self.model).where(self.model.id == record_id)  # type: ignore[attr-defined]
        )
        return result.rowcount  # type: ignore[union-attr]

    async def count(self, **filters: Any) -> int:
        query = select(sa_func.count()).select_from(self.model)
        for attr, value in filters.items():
            query = query.where(getattr(self.model, attr) == value)
        result = await self.session.execute(query)
        return result.scalar_one()
