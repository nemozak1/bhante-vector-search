from fastapi import FastAPI

from src.server.schema import UserInput
from src.server.database.db_config import vector_store_from_client

app = FastAPI()

@app.get("/search")
async def search(user_input: UserInput):

    query = user_input.query

    retrieved_docs = vector_store_from_client.similarity_search(query, k=10, filter={"category": "NarrativeText"})

    return {"query": query}