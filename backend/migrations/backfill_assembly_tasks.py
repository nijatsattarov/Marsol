"""One-off migration: convert legacy assembly-generated tasks
whose `assignee`/`responsible_person` were stored as comma-joined
strings into proper lists so MongoDB element-match works and each
assignee sees the task in their personal Tapşırıqlar module.

Also backfills `created_by` and `marsol_company` from the parent
assembly when they are empty.
"""
import asyncio, os, sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    cursor = db.tasks.find({"source": "assembly"}, {"_id": 0})
    fixed = 0
    scanned = 0
    async for t in cursor:
        scanned += 1
        update = {}
        for fld in ("assignee", "responsible_person"):
            v = t.get(fld)
            if isinstance(v, str):
                lst = [x.strip() for x in v.split(",") if x.strip()]
                if lst:
                    update[fld] = lst
        if not t.get("created_by") or not t.get("marsol_company"):
            asm = await db.assemblies.find_one({"id": t.get("assembly_id")}, {"_id": 0})
            if asm:
                if not t.get("created_by"):
                    update["created_by"] = asm.get("created_by") or ""
                if not t.get("marsol_company"):
                    update["marsol_company"] = asm.get("marsol_company") or ""
                if not t.get("creator_department"):
                    update["creator_department"] = asm.get("department") or ""
        if update:
            await db.tasks.update_one({"id": t["id"]}, {"$set": update})
            fixed += 1
    print(f"Scanned assembly-tasks: {scanned}, fixed: {fixed}")

asyncio.run(main())
