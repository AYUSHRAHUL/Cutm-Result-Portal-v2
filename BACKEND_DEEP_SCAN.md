# Backend Deep Scan Report

## Overview
This report details the findings from a comprehensive scan of the `app/api`, `lib`, and `models` directories.

## Architecture Pattern: "Logic-on-Read"
The application relies heavily on parsing `Reg_No` (Registration Number) at runtime to derive metadata, rather than storing this metadata explicitly in the database.
- **Mechanism**: The `parseBTechRegistration` and `parseDiplomaRegistration` functions slice the 12-digit registration string to extract:
  - **Year/Batch**: Indices 0-2
  - **Institute**: Indices 2-6
  - **Branch**: Indices 5-7
- **Implication**: The database primarily stores raw result data (`Reg_No`, `Grade`, `Subject_Code`). Queries often fetch large datasets and filter them in memory using JavaScript because the specific fields (like "Branch Name") generally don't exist as indexable columns in the MongoDB collection.

## Key Modules
1.  **Authentication (`app/api/auth`)**
    -   **Method**: Custom JWT implementation.
    -   **Storage**: HTTP-Only cookies.
    -   **Database Access**: Uses `clientPromise` (Native MongoDB Driver) to fetch users, despite `User` model (Mongoose) being present.
    -   **Role Management**: Roles (`admin`, `teacher`, `user`) are stored in the `USER` database.

2.  **Analytics (`app/api/soet/analytics` & `app/api/sovet/analytics`)**
    -   **Dual Pipelines**: Separate routes for B.Tech (SOET) and Diploma (SOVET) with nearly identical logic.
    -   **Data Fetching**: Fetches up to **50,000** records (`MAX_ANALYTICS_RECORDS`) into memory.
    -   **Processing**: Iterates through these records to compute pass rates, grade distributions, and failed students.
    -   **Performance Risk**: The 50k document limit is a hard cap. If the dataset grows larger, analytics will return incomplete data without warning. The in-memory processing is CPU intensive for large concurrent requests.

3.  **Parsers (`app/api/*/parse-registration`)**
    -   Central logic for decoding registration numbers.
    -   Hardcoded maps for Branch Codes (e.g., `112` -> `CSE`).
    -   **Maintenance**: Adding a new branch requires updating these maps in code.

4.  **Honours Module (`app/api/honours`)**
    -   Follows a more RESTful CRUD pattern compared to the read-heavy analytics routes.

## Database & Infrastructure
-   **Database**: MongoDB.
    -   **Connection**: Handled via `lib/mongodb.js` using `MongoClient` with a connection pool (max 3 connections).
    -   **Mixed Usage**: The codebase contains both Mongoose models (`models/User.js`) and direct driver code. The application runtime predominantly uses the direct driver.
-   **Caching**: `lib/redis.js` exists, suggesting Redis is available, though its usage in the analytics routes scanned was not prominent (analytics routes mostly use in-memory Sets for deduplication during the request).

## Critical Observations
1.  **Scalability**: The "fetch-all-and-filter" approach in analytics is not scalable. As data grows, this will become slow and eventually incorrect due to the 50k limit.
    -   *Recommendation*: Pre-calculate stats or add fields like `Branch`, `Batch`, `Year` to the MongoDB documents during upload to allow for database-level aggregation.
2.  **Code Duplication**: `soet` and `sovet` logic is ~90% identical.
    -   *Recommendation*: Abstract the analytics logic into a generic service that accepts a "parser strategy" or configuration.
3.  **Consistency**: Inconsistent use of Mongoose vs Native Driver.
    -   *Recommendation*: Standardize on one (likely Native Driver given the performance needs of bulk analytics).

## Conclusion
The backend is functional and structured logically by domain. However, the reliance on runtime string parsing and in-memory aggregation of large datasets presents a significant scalability ceiling.
