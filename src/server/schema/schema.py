from pydantic import BaseModel, Field

class UserInput(BaseModel):

    query: str = Field(
        description="User input to the search.",
        examples=["What did Bhante say about death?"],
    )
