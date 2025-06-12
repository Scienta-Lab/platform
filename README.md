# Eva

# How to run locally?

1. Install the dependencies using `pnpm install` (get pnpm [here](https://pnpm.io/installation))
2. Run the dev server using `pnpm dev`

# How to deploy?

Just push to any branch. Vercel will trigger a deployment automatically.
However, for now only the main branch has the env vars required to run the project.

# How to invite new users?

1. Sign in with an admin account (listed in `adminWhitelist` under `lib/dal.ts`).
2. Visit `/tools/invite` and enter the user email. The user will receive an expiring link to create their account.

# Where can I see all users (pending, registered, etc.)?

From the AWS dashboard, go to: Cognito > Eva User Pool > And down User Management in the sidebar, click `Users`.

## DynamoDB tables

We have two tables. `InvitationTokens` is very simple, but `Chat` is more complex as we store two types of data in the same table (single-table pattern).

To explore or edit them, from the AWS dashboard, go to: DynamoDB > Explore Items > the table you want.

You then have two options:

1. Scan: go through the entire db every time. Avoid this if you can.
2. Query: you have to enter a partition key (and can also specify a sort key). Partition and sort keys format is described below. But for example to find a given conversation, you would enter `CONVERSATION#{PK}` where `{PK}` is the conversation id you'll find in the conversation URL

### InvitationTokens

Partition key: token (type: String)

### Chat

Partition key: PK (type: String)
Sort key: SK (type: String)

We store two main types of items in this table: `ConversationMetadata` and `Message`.

1.  **ConversationMetadata Item:**

    - **Partition Key (PK):** `USER#<userId>`
      - Example: `USER#cognito_user_sub_123`
    - **Sort Key (SK):** `CONVERSATION#<conversationId>`
      - Example: `CONVERSATION#uuid_for_conversation_abc`
    - **Attributes:** of type `ConversationMetadata` (see `app/actions/chat.ts`)

2.  **Message Item:**
    - **Partition Key (PK):** `CONVERSATION#<conversationId>`
    - **Sort Key (SK):** `MESSAGE#<timestamp_iso8601>#<message_uuid>`
    - **Attributes:**: of type `UIMessage` (from the AI SDK) extended with `UIMessageAnnotation` (see `lib/chat.ts`)

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
