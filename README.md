# Eva

## DynamoDB tables

### InvitationTokens

Partition key: token (type: String)

### Chat

Partition key: PK (type: String)
Sort key: SK (type: String)

We store two main types of items in this table: `ConversationMetadata` and `Message`.

1.  **ConversationMetadata Item:**

    - **Primary Key (PK):** `USER#<userId>`
      - Example: `USER#cognito_user_sub_123`
    - **Sort Key (SK):** `CONVERSATION#<conversationId>`
      - Example: `CONVERSATION#uuid_for_conversation_abc`
    - **Attributes:**
      - `title`: String
      - `createdAt`: String

2.  **Message Item:**
    - **Primary Key (PK):** `CONVERSATION#<conversationId>`
    - **Sort Key (SK):** `MESSAGE#<timestamp_iso8601>#<message_uuid>`
    - **Attributes:**
      - `userId`: String (Cognito user's `sub`)
      - `role`: String ("user" or "assistant")
      - `type`: String ("text" or "figure")
      - `content`: String (if type is "figure", then stores stringified JSON of params required to build the figure)

**How Access Patterns Work:**

- **1. Starting a New Conversation for a User:**

  1.  Generate a new unique `conversationId` (e.g., a UUID).
  2.  Create a `ConversationMetadata` item:
      - PK: `USER#<userId>`
      - SK: `CONVERSATION#<new_conversationId>`
      - Attributes: `createdAt` (now), `title` (optional).

- **2. Adding a Message to an Existing Conversation:**

  - Create a `Message` item:
    - PK: `CONVERSATION#<conversationId>`
    - SK: `MESSAGE#<current_timestamp>#<new_message_uuid>`
    - Attributes: `userId`, `role`, `content`, `type`.

- **3. Listing All Conversations for a User**

  1.  Query the table:
      - `KeyConditionExpression`: `PK = :user_pk` (where `:user_pk` is `USER#<userId>`)
      - `FilterExpression`: `begins_with(SK, :conv_prefix)` (where `:conv_prefix` is `CONVERSATION#`)
  2.  This retrieves all `ConversationMetadata` items for the user.

- **4. Retrieving All Messages for a Specific Conversation (Chronologically):**
  1.  Query the table:
      - `KeyConditionExpression`: `PK = :conv_pk` (where `:conv_pk` is `CONVERSATION#<conversationId>`)
      - `FilterExpression`: `begins_with(SK, :msg_prefix)` (where `:msg_prefix` is `MESSAGE#`)
      - `ScanIndexForward`: `true` (default) to get messages sorted by the SK (i.e., by timestamp).
