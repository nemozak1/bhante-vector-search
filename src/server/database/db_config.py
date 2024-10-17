import chromadb
import os

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from chromadb.config import DEFAULT_TENANT, DEFAULT_DATABASE, Settings
from dotenv import load_dotenv

try:
    load_dotenv()
    collection_name = os.getenv("CHROMADB_COLLECTION_NAME", "bhante_test")
except:
    print("Error loading .env file, using default chromadb collection name 'bhante_test'")

collection_name = "bhante_test"
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

chroma_persistent_client = chromadb.PersistentClient(
    settings=Settings(),
    tenant=DEFAULT_TENANT,
    database=DEFAULT_DATABASE,
)

collection = chroma_persistent_client.get_or_create_collection(collection_name)

vector_store_from_client = Chroma(
    client=chroma_persistent_client,
    collection_name=collection_name,
    embedding_function=embeddings,
)