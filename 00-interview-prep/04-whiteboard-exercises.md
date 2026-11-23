<div dir="rtl">

# تمرین‌های تخته‌سفید برای طراحی سیستم‌های هوش مصنوعی (AI System Design)

این فصل راهنمای گام‌به‌گام و تفصیلی تمرین‌های طراحی سیستم را ارائه می‌دهد که معمولاً در مصاحبه‌های متمرکز بر هوش مصنوعی پرسیده می‌شوند. هر تمرین شامل صورت کامل مسئله، رویکرد حل ساختاریافته، و نکات تحلیلی است که داوطلبان برتر را متمایز می‌کند.

## جدول محتوا

- [تمرین ۱: سیستم RAG سازمانی](#exercise-1-enterprise-rag-system)
- [تمرین ۲: چت‌بات پشتیبانی مشتریان](#exercise-2-customer-support-chatbot)
- [تمرین ۳: دستیار بررسی کد (Code Review)](#exercise-3-code-review-assistant)
- [تمرین ۴: پایپ‌لاین پردازش اسناد](#exercise-4-document-processing-pipeline)
- [تمرین ۵: نظارت بر محتوا به‌صورت بلادرنگ](#exercise-5-real-time-content-moderation)
- [تمرین ۶: پلتفرم هوش مصنوعی چندمستأجره](#exercise-6-multi-tenant-ai-platform)
- [تمرین ۷: جستجوی معنایی در مقیاس بالا](#exercise-7-semantic-search-at-scale)
- [تمرین ۸: پایپ‌لاین ارزیابی برای یک محصول LLM در محیط عملیاتی](#exercise-8-evaluation-pipeline-for-a-production-llm-product)
- [تمرین ۹: حافظه و وضعیت برای یک Agent با اجرای طولانی‌مدت](#exercise-9-memory-and-state-for-a-long-running-agent)
- [تمرین ۱۰: سرویس Batching در استنتاج روی یک GPU منفرد](#exercise-10-inference-batching-service-on-a-single-gpu) ⭐ *جدید*
- [نکاتی برای تمرین‌های تخته‌سفید](#tips-for-whiteboard-exercises)

---

## تمرین ۱: سیستم RAG سازمانی

### صورت مسئله

یک دستیار دانشی مبتنی بر RAG برای یک سازمان بزرگ با نیازمندی‌های زیر طراحی کنید:

- ۱۰ میلیون سند از منابع چندگانه (SharePoint، Confluence، Google Drive، ویکی‌های داخلی)
- ۵۰,۰۰۰ کارمند با سطوح دسترسی مبتنی بر نقش (Role-based access)
- اسناد به‌صورت مداوم به‌روزرسانی می‌شوند
- رعایت کامل دسترسی‌های اسناد در زمان اجرای پرس‌وجو الزامی است
- زمان پاسخ‌دهی زیر ۳ ثانیه برای ۹۵٪ از پرس‌وجوها (p95 < 3s)
- پشتیبانی از چند زبان (انگلیسی، اسپانیایی، چینی ماندارین)

### تخصیص زمان (۳۵ دقیقه)

| فاز | زمان | تمرکز |
|-------|------|-------|
| شفاف‌سازی (Clarification) | ۳ دقیقه | دامنه، اولویت‌ها، قیدها و محدودیت‌ها |
| معماری در سطح بالا | ۷ دقیقه | مولفه‌ها و جریان داده‌ها |
| پایپ‌لاین داده | ۸ دقیقه | ورود داده (Ingestion)، Chunking، نمایه‌سازی |
| پایپ‌لاین پرس‌وجو | ۸ دقیقه | بازیابی، تولید متن، دسترسی‌ها |
| پایداری و مقیاس‌پذیری | ۵ دقیقه | مدیریت شکست، مقیاس‌دهی |
| ارزیابی (Evaluation) | ۴ دقیقه | متریک‌ها و مانیتورینگ |

### راهنمای گام‌به‌گام راه‌حل

#### سؤالات شفاف‌کننده

```
1. What is the document size distribution? (PDFs, wikis, code?)
2. How often do permissions change? (Impacts caching strategy)
3. Is conversation history required or single-turn Q&A?
4. What is the accuracy bar? (Can we say "I don't know"?)
5. Are there compliance requirements? (Audit, data residency)
```

#### معماری در سطح بالا

<div dir="ltr">

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA PLANE                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐│
│  │   Connectors │───▶│   Processor  │───▶│       Vector Database        ││
│  │ (SP,GD,Conf) │    │ (chunk,embed)│    │  (Pinecone/Qdrant/Weaviate)  ││
│  └──────────────┘    └──────────────┘    └──────────────────────────────┘│
│                                                      ▲                   │
│                                                      │ sync              │
│  ┌──────────────────────────────────────────────────┼───────────────────┐│
│  │                    Permission Service            │                   ││
│  └──────────────────────────────────────────────────┼───────────────────┘│
└─────────────────────────────────────────────────────┼───────────────────┘
                                                      │
┌─────────────────────────────────────────────────────┼───────────────────┐
│                          QUERY PLANE                │                   │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────┴──────┐             │
│  │    User      │───▶│  Query API   │───▶│   Retriever    │             │
│  │  Interface   │    │              │    │ (+ perm filter)│             │
│  └──────────────┘    └──────────────┘    └────────┬───────┘             │
│                             │                      │                     │
│                             ▼                      ▼                     │
│                      ┌──────────────┐    ┌──────────────┐               │
│                      │   Reranker   │◀───│   Chunks     │               │
│                      └──────┬───────┘    └──────────────┘               │
│                             │                                            │
│                             ▼                                            │
│                      ┌──────────────┐    ┌──────────────┐               │
│                      │  Generator   │───▶│   Response   │               │
│                      │    (LLM)     │    │  + Citations │               │
│                      └──────────────┘    └──────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

</div>

#### تحلیل عمیق پایپ‌لاین داده

**۱. اتصال‌دهنده‌ها (Connectors):**
```
Each source has a dedicated connector:
- SharePoint: Graph API with delta sync
- Confluence: REST API with webhooks
- Google Drive: Drive API with push notifications

Connector responsibilities:
- Fetch document content and metadata
- Track change events (create, update, delete)
- Extract permissions from source system
- Normalize to common document schema
```

**۲. شمای اسناد (Document Schema):**
```json
{
  "doc_id": "uuid",
  "source": "sharepoint|confluence|gdrive",
  "source_id": "original_id_in_source",
  "title": "string",
  "content": "string",
  "content_type": "pdf|html|docx|md",
  "language": "en|es|zh",
  "permissions": {
    "users": ["user_id_1", "user_id_2"],
    "groups": ["group_id_1"],
    "visibility": "private|internal|public"
  },
  "metadata": {
    "author": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "path": "folder/path"
  }
}
```

**۳. استراتژی Chunking:**
```
Given mixed document types, use adaptive chunking:

- Markdown/HTML: Semantic chunking by headers
- PDFs: Layout-aware chunking using document AI
- Wiki pages: Section-based chunking

Chunk parameters:
- Target size: 512 tokens
- Overlap: 50 tokens
- Preserve: headers, tables, code blocks

Each chunk inherits parent document permissions.
```

**۴. ساخت بردار (Embedding):**
```
Multilingual requirement suggests:
- Model: Cohere Embed 5 (embed-v5.0-pro: 100+ languages, 128K
  context, $0.12/1M text tokens)
- Alternatives: voyage-4-large ($0.12/1M) or gemini-embedding-2;
  self-hosted Nemotron 3 Embed 8B (NVIDIA reports #1 on RTEB
  Multilingual) if text cannot leave the VPC
- Decide with a bake-off on real Spanish and Mandarin queries,
  not leaderboard averages

Backfill cost: 50M chunks × ~512 tokens ≈ 26B tokens, about $3K
at $0.12/1M. Re-embedding is cheap; the re-index time is what
you plan around.

Batch embedding:
- Process in batches of 100 chunks
- Rate limit handling with exponential backoff
- Store embedding with chunk in vector DB
```

**۵. انتخاب پایگاه داده برداری (Vector Database):**
```
Pinecone or Qdrant for this scale.

Selection criteria:
- Metadata filtering: Critical for permissions
- Scale: 10M docs × 5 chunks = 50M vectors
- Hybrid search: Needed for keyword queries. Pinecone's full-text
  search (GA September 2026) ranks by one scoring type per query,
  so run BM25 and vector searches separately and fuse client-side
  with RRF

Schema:
- Vector: embedding
- Metadata: doc_id, chunk_id, language, permissions, source
```

#### تحلیل عمیق پایپ‌لاین پرس‌وجو

**۱. تحلیل و تفکیک دسترسی‌ها:**
```python
def get_user_permissions(user_id: str) -> PermissionSet:
    """
    Resolve all documents user can access.
    Returns set of:
    - Direct user grants
    - Group memberships expanded
    - Public document access
    
    CACHED with 5-minute TTL since permissions change infrequently.
    """
    cache_key = f"permissions:{user_id}"
    if cached := cache.get(cache_key):
        return cached
    
    perms = permission_service.resolve(user_id)
    cache.set(cache_key, perms, ttl=300)
    return perms
```

**۲. بازیابی همراه با اعمال فیلتر دسترسی:**
```python
def retrieve(query: str, user_id: str, top_k: int = 20) -> List[Chunk]:
    perms = get_user_permissions(user_id)
    
    # Detect language for query
    lang = detect_language(query)
    
    # Build permission filter
    # User can see: public docs, their own, or groups they belong to
    filter = {
        "$or": [
            {"visibility": "public"},
            {"users": {"$in": [user_id]}},
            {"groups": {"$in": perms.groups}}
        ]
    }
    
    # Optional: boost same-language content
    if lang != "en":
        filter["language"] = lang
    
    results = vector_db.search(
        query_embedding=embed(query),
        top_k=top_k,
        filter=filter
    )
    return results
```

**۳. رتبه‌بندی مجدد (Reranking):**
```
Rerank top-20 to get top-5 with a cross-encoder.
Model: a hosted 32K-context reranker, Cohere Rerank 5 (Pro $0.05,
Fast $0.02 per 1M tokens) or Voyage rerank-3, or self-hosted
bge-reranker-v2-m3 (multilingual, open weights); verify on Spanish
and Mandarin queries before choosing
Latency budget: ~150ms (matches the p95 budget below)
```

**۴. تولید پاسخ (Generation):**
```python
def generate(query: str, chunks: List[Chunk], user_id: str) -> Response:
    context = format_chunks_with_citations(chunks)
    
    prompt = f"""You are a knowledge assistant for [Company].
Answer the question using ONLY the provided context.
If the context does not contain the answer, say "I could not find information about that in our knowledge base."
Always cite sources using [1], [2] format.

CONTEXT:
{context}

QUESTION: {query}
"""
    
    response = llm.generate(
        prompt=prompt,
        model="claude-sonnet-5-5",  # pinned ID; the fallback route is another vendor
        effort="low",               # API default is "high"; unset, it eats the latency budget
    )
    
    return format_with_source_links(response, chunks)
```

در اینجا از پارامتر `temperature` استفاده نمی‌شود: نسخه `2026-10-21` در API کلود برای هرگونه پارامتر نمونه‌برداری در تمام مدل‌ها خطای 400 برمی‌گرداند (حتی روی مقدار پیش‌فرض آن)، و GPT-6 Astra نیز آن‌ها را نمی‌پذیرد. مستندسازی پاسخ بر پایه پرامپت، بازیابی دقیق و بررسی ارجاعات حاصل می‌شود، نه تنظیمات نمونه‌برداری.

#### مقیاس‌پذیری و پایداری (Scaling and Reliability)

**بودجه تاخیر (p95 < 3s):**

<div dir="ltr">

```
Permission resolution:   50ms  (cached)
Embedding:              100ms
Vector search:          100ms
Reranking:              150ms
LLM generation:        1500ms
Network/overhead:       100ms
─────────────────────────────
Total:                 2000ms (buffer for P95)
```

</div>

**ملاحظات مقیاس‌پذیری:**
```
- Vector DB: Sharded by source or hash
- Embedding service: Horizontal scale, stateless
- LLM calls: Multiple providers for redundancy
- Cache: Redis cluster for permissions and responses
```

**مدیریت شکست:**
```
- Vector DB down: Return cached results + degraded warning
- LLM down: Fallback to secondary provider
- Rate limiting: Queue with backpressure
- Embedding service: Batch retries with circuit breaker
```

#### رویکرد ارزیابی (Evaluation)

**متریک‌های آفلاین:**
```
- Retrieval: Precision@5, Recall@5, MRR
- Generation: RAGAS (faithfulness, relevance)
- End-to-end: Answer correctness on test set
```

**متریک‌های آنلاین:**
```
- User feedback: Thumbs up/down
- Query reformulation rate: User rephrasing indicates failure
- Citation click-through: Are sources useful?
```

**مانیتورینگ:**
```
- Latency dashboards by percentile
- Permission filter hit rate
- Empty result rate by source
- Cost per query
```

---

## تمرین ۲: چت‌بات پشتیبانی مشتریان

### صورت مسئله

یک سیستم پشتیبانی مشتریان مبتنی بر هوش مصنوعی برای یک شرکت تجارت الکترونیک طراحی کنید:

- پردازش ۱۰,۰۰۰ گفتگو در روز
- دسترسی به کاتالوگ محصولات (۱ میلیون محصول)، تاریخچه سفارشات، پرسش‌های متداول (FAQ)
- هدف: حل ۷۰٪ تیکت‌ها بدون نیاز به ارجاع به اپراتور انسانی
- پشتیبانی از استعلام سفارش، مرجوعی، و سؤالات محصول
- پشتیبانی از ۳ زبان
- ادغام با سیستم تیکتینگ موجود (Zendesk)

### نکات برجسته راه‌حل

**تصمیمات کلیدی معماری:**

۱. **معماری Agent همراه با کنترل جریان (Flow Control):**
<div dir="ltr">

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ┌─────────┐     ┌─────────────┐     ┌─────────────┐   │
│   │ Intake  │────▶│  Classify   │────▶│   Router    │   │
│   └─────────┘     └─────────────┘     └──────┬──────┘   │
│                                              │           │
│         ┌────────────────┬──────────────────┼───────┐   │
│         ▼                ▼                  ▼       ▼   │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐ ┌─────┐ │
│   │Order Flow │   │Product Q&A│   │ Returns   │ │Human│ │
│   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘ └─────┘ │
│         │               │               │               │
│         └───────────────┴───────────────┘               │
│                         │                               │
│                   ┌─────▼─────┐                         │
│                   │  Response │                         │
│                   │ Generator │                         │
│                   └───────────┘                         │
└─────────────────────────────────────────────────────────┘
```

</div>

۲. **طراحی ابزارها (Tools):**
```python
tools = [
    {
        "name": "lookup_order",
        "description": "Look up order details by order ID or customer email",
        "parameters": {
            "order_id": "optional string",
            "email": "optional string"
        }
    },
    {
        "name": "search_products",
        "description": "Search product catalog",
        "parameters": {
            "query": "string",
            "category": "optional string",
            "price_range": "optional tuple"
        }
    },
    {
        "name": "create_return",
        "description": "Initiate a return for an order",
        "parameters": {
            "order_id": "string",
            "reason": "string",
            "items": "list of item IDs"
        }
    },
    {
        "name": "escalate_to_human",
        "description": "Transfer to human agent",
        "parameters": {
            "reason": "string",
            "priority": "low|medium|high"
        }
    }
]
```

۳. **معیارهای ارجاع به انسان (Escalation Criteria):**
```
Escalate to human when:
- Customer explicitly requests human
- Sentiment is highly negative (detected by classifier)
- Issue involves payment disputes
- Agent confidence is low after 2 attempts
- Complex multi-order issues
- Refund above threshold amount
```

۴. **الگوی یکپارچه‌سازی با Zendesk:**
```
Zendesk integration:
- Webhook receives new tickets
- AI handles via API
- Resolution → close ticket
- Escalation → assign to queue with context summary
- All interactions logged to ticket timeline
```

---

## تمرین ۳: دستیار بررسی کد (Code Review Assistant)

### صورت مسئله

یک دستیار بررسی کد برای یک پلتفرم توسعه نرم‌افزار طراحی کنید:

- بررسی خودکار Pull Requestها
- ارائه بازخوردهای مشخص و عملیاتی
- رعایت راهنماهای سبک کدنویسی (Style guides) و کنوانسیون‌های ریپازیتوری
- توانایی پیشنهاد اصلاحات کد
- یکپارچه‌سازی با GitHub / GitLab
- توانایی پردازش ۵۰,۰۰۰ پول ریکوئست (PR) در روز

### نکات برجسته راه‌حل

**انتخاب‌های فنی کلیدی:**

۱. **سرهم‌بندی کانتکست (Context Assembly):**
```
For each changed file, assemble context:
- The diff (changed lines)
- Full file content (for understanding)
- Related files (imports, tests, types)
- Repository conventions (.eslintrc, .editorconfig)
- Previous review comments (learn from feedback)
```

۲. **دسته‌بندی‌های بررسی:**
```python
review_types = [
    "bug_risk",           # Potential bugs
    "security",           # Security issues
    "performance",        # Performance concerns
    "maintainability",    # Code quality
    "style",              # Style guide violations
    "test_coverage"       # Missing tests
]
```

۳. **انتخاب مدل:**
```
Primary: Claude Sonnet 5.5 or GPT-6.1 Sol (both $2/$10 per 1M);
  pick with a bake-off on a few hundred past PRs whose real
  review outcomes you know
Escalation: Claude Opus 5.5 ($4/$20) for large or
  security-sensitive diffs
Fallback: the other vendor's mid-tier model, with its own
  tested prompt

Specialized models:
- Security scanning: CodeQL + LLM review
- Style: Linters + LLM explanation

Cost check (50K PRs/day, ~30K input tokens of assembled context
and ~2K output tokens per PR, $2/$10 model):
  50K × (30K × $2/1M + 2K × $10/1M) = 50K × $0.08
  = $4,000/day ≈ $120K/month before caching
Levers: cache repository conventions and shared files as a
prefix, skip generated and vendored files, set effort per route
(thinking tokens bill as output), escalate selectively.
```

۴. **فرمت خروجی:**
````markdown
## Review Summary

### Critical Issues (must fix)
- **Line 45**: SQL injection vulnerability in user query
  ```python
  # Instead of:
  query = f"SELECT * FROM users WHERE id = {user_id}"
  # Use:
  query = "SELECT * FROM users WHERE id = ?"
  cursor.execute(query, (user_id,))
  ```

### Suggestions (consider fixing)
- **Line 78-82**: This loop could be simplified using list comprehension
...
````

۵. **استراتژی مدیریت تاخیر (Latency):**
```
Target: Review ready within 2 minutes of PR creation

Strategy:
- Queue PR for processing
- Parallel processing of files
- Stream results as available
- Cache repository conventions
```

۶. **اختیار تایید (Approval Authority):**
دستیار هوش مصنوعی کامنت ثبت می‌کند؛ اما به‌صورت پیش‌فرض تایید (Approve) نمی‌کند. از ۲۸ اکتبر ۲۰۲۶ قابلیت تایید بررسی کد با Copilot در گیت‌هاب به‌صورت عمومی عرضه شد: هنگامی که مدیر مخزن آن را فعال می‌کند، تایید Copilot جزو تاییدیه‌های الزامی مخزن شمرده می‌شود، مدیران مشخص می‌کنند Copilot مجاز به تایید چه مسیرهایی است، و پوش کردن کامیت‌های جدید تاییدیه را باطل می‌سازد. بنابراین سناریوی «تایید یک Agent توسط Agent دیگر» اکنون یک پیکربندی واقعی است، نه صرفاً یک فرض نظری. اگر چنین قابلیتی را فعال می‌کنید، آن را به مسیرهای کم‌ریسک محدود کنید، هرگز اجازه ندهید یک Agent پول ریکوئستی را که خودش نوشته تایید کند، و تاییدیه را با هر کامیت جدید باطل نمایید. انتظار پرسیدن این سؤال درباره تفکیک وظایف (Separation of duties) را در مصاحبه داشته باشید.

---

## تمرین ۴: پایپ‌لاین پردازش اسناد

### صورت مسئله

یک پایپ‌لاین پردازش اسناد برای خدمات مالی طراحی کنید:

- پردازش ۱۰۰,۰۰۰ سند در روز (فاکتورها، قراردادها، فرم‌ها)
- استخراج داده‌های ساختاریافته با دقت ۹۹٪
- پشتیبانی از فایل‌های PDF، اسناد اسکن‌شده، و دست‌نوشته‌ها
- انطباق کامل با استانداردهای HIPAA و SOC2
- بازبینی انسانی برای استخراج‌های با ضریب اطمینان پایین

### نکات برجسته راه‌حل

**معماری پایپ‌لاین:**
<div dir="ltr">

```
┌────────┐   ┌───────────┐   ┌────────────┐   ┌────────────┐
│ Ingest │──▶│ Classify  │──▶│  Extract   │──▶│  Validate  │
└────────┘   └───────────┘   └────────────┘   └────────────┘
                                                     │
                                     ┌───────────────┼───────────────┐
                                     ▼               ▼               ▼
                              ┌──────────┐   ┌──────────┐   ┌──────────┐
                              │ Auto-pass│   │  Review  │   │  Reject  │
                              └──────────┘   └──────────┘   └──────────┘
```

</div>

**مولفه‌های کلیدی:**

۱. **کلاس‌بندی اسناد:**
```
Fine-tuned classifier on document types:
- Invoice, Contract, Receipt, Form, ID, Other

Model: LayoutLMv3 or fine-tuned ViT
Confidence threshold: 0.95 for auto-routing
```

۲. **استراتژی استخراج (Extraction Strategy):**
```
Tiered extraction based on document type:

Tier 1: Document AI (Textract, Azure Document Intelligence, or a
parsing API such as Cohere parse-v5.0 at $1.50 per 1,000 pages)
- Good for structured forms
- Fast and cheap
- Returns confidence scores

Tier 2: Vision LLM (Claude Opus 5.5, GPT-6.1 Sol, Gemini 3.8 Flash)
- Fallback for complex layouts
- Better for unstructured text
- More expensive

Combine outputs and cross-validate.

Pin model IDs and re-run the extraction eval on a schedule, not
only on ID changes: OpenAI fixed an image-encoding bug that had
degraded image understanding in GPT-6 Sol and GPT-6 Luna on
September 25, 2026, without changing either ID.
```

۳. **قوانین اعتبارسنجی (Validation Rules):**
```python
validation_rules = {
    "invoice": [
        ("total", lambda x: x > 0, "Total must be positive"),
        ("date", lambda x: parse_date(x), "Invalid date format"),
        ("vendor_id", lambda x: regex_match(x, TAX_ID_PATTERN), "Invalid tax ID"),
        ("line_items", lambda x: sum(i.amount for i in x) == total, "Line items must sum to total")
    ],
    "contract": [
        ("parties", lambda x: len(x) >= 2, "Contract must have at least 2 parties"),
        ("effective_date", lambda x: parse_date(x), "Invalid date"),
        ("signature_present", lambda x: x == True, "Signature required")
    ]
}
```

۴. **رابط کاربری بازبینی انسانی:**
```
Reviewer sees:
- Original document image
- Extracted fields with confidence scores
- Validation errors highlighted
- Suggested corrections from LLM
- One-click approval or field-level corrections
```

۵. **تدابیر انطباق و امنیت:**
```
HIPAA/SOC2 requirements:
- All documents encrypted at rest (AES-256)
- TLS 1.3 in transit
- Audit log for all access and changes
- PHI detection and masking
- Retention policies enforced
- Access controls with MFA
- Model-provider retention checked per model, not per vendor:
  Claude Opus 5.5 and Sonnet 5.5 are available with zero data
  retention, while Fable 5.1 requires 30-day retention unless
  Anthropic expressly authorizes ZDR
```

---

## تمرین ۵: مدیریت و نظارت بر محتوا به‌صورت بلادرنگ (Real-Time Content Moderation)

### صورت مسئله

یک سیستم نظارت بر محتوا برای یک پلتفرم شبکه اجتماعی طراحی کنید:

- ۱ میلیون پست در روز (متن، تصویر، ویدیو)
- الزام تاخیر: نمایش پست‌ها در کمتر از ۵۰۰ میلی‌ثانیه
- تشخیص موارد: سخنان نفرت‌پراکنانه، خشونت، محتوای غیراخلاقی، هرزنامه (اسپم)
- فرآیند تجدیدنظر (Appeal) برای موارد مثبت کاذب (False positives)
- پشتیبانی از ۱۰ زبان مختلف

### نکات برجسته راه‌حل

**الگوی معماری: آبشار چندمرحله‌ای (Multi-Stage Cascade)**
<div dir="ltr">

```
         ┌───────────────────────────────────────────┐
         │              Fast Filters                 │
         │   (regex, blocklist, hash matching)       │
         └─────────────────┬─────────────────────────┘
                           │ Pass 95%
                           ▼
         ┌───────────────────────────────────────────┐
         │            ML Classifiers                 │
         │   (text: BERT, image: CLIP, video: X3D)   │
         └─────────────────┬─────────────────────────┘
                           │ Uncertain 5%
                           ▼
         ┌───────────────────────────────────────────┐
         │            LLM Analysis                   │
         │   (context-aware, nuanced decisions)      │
         └─────────────────┬─────────────────────────┘
                           │ Still uncertain 0.5%
                           ▼
         ┌───────────────────────────────────────────┐
         │            Human Review                   │
         └───────────────────────────────────────────┘
```

</div>

**تصمیمات کلیدی طراحی:**

۱. **بهینه‌سازی تاخیر (Latency):**
```
Target: 500ms total

Stage 1 (Fast): 20ms
- Regex patterns
- Known hash matching (PhotoDNA)
- Blocklist lookup

Stage 2 (ML): 80ms
- Batched inference on GPU
- Small specialized models
- Parallel text/image processing

Stage 3 (LLM): 400ms (async for borderline)
- Only 5% of content reaches here
- Used for nuanced decisions
```

۲. **استراتژی آستانه‌های تصمیم‌گیری (Thresholds):**
```python
class ModerationDecision:
    BLOCK = "block"          # High confidence violation
    ALLOW = "allow"          # High confidence safe
    LIMIT = "limit"          # Reduce distribution
    REVIEW = "human_review"  # Queue for human

thresholds = {
    "hate_speech": {
        "block": 0.95,
        "limit": 0.80,
        "review": 0.60
    },
    "adult_content": {
        "block": 0.98,  # Higher threshold, legal implications
        "limit": 0.90,
        "review": 0.70
    }
}
```

۳. **جریان کاری تجدیدنظر (Appeal Workflow):**
```
1. User submits appeal
2. Content queued for human review
3. Different reviewer than original (blind review)
4. Decision logged with reasoning
5. If overturned:
   - Content restored
   - Original decision added to training data as negative
   - Model retrained periodically
```

---

## تمرین ۶: پلتفرم هوش مصنوعی چندمستأجره (Multi-Tenant AI Platform)

### صورت مسئله

یک پلتفرم هوش مصنوعی چندمستأجره (AI-as-a-Service) طراحی کنید:

- سرویس‌دهی به بیش از ۵۰۰ مشتری سازمانی
- هر مشتری اسناد و مدل‌های اختصاصی خود را دارد
- ایزوله‌سازی کامل داده‌ها بین مستأجرها (Tenants)
- رهگیری مصرف و صورت‌حساب به تفکیک هر مشتری
- سطوح قیمتی مختلف همراه با قابلیت‌های متفاوت
- رعایت الزامات انطباق با استاندارد SOC2

### نکات برجسته راه‌حل

**معماری ایزوله‌سازی مستأجرها:**
<div dir="ltr">

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   Auth → Tenant Context → Rate Limit → Route             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tenant-Aware Service Layer                    │
│                                                                  │
│  All operations scoped to tenant_id from context                │
│  - Retrieval filters by tenant                                  │
│  - Cache keys prefixed by tenant                                │
│  - Audit logs include tenant                                    │
└─────────────────────────────────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Shared Vector  │ │  Shared LLM     │ │  Shared Object  │
│  DB (filtered)  │ │  (no tenant     │ │  Storage        │
│                 │ │   data in prompt│ │  (tenant paths) │
│  tenant_id in   │ │   history)      │ │                 │
│  all metadata   │ │                 │ │  s3://bucket/   │
└─────────────────┘ └─────────────────┘ │  {tenant_id}/   │
                                        └─────────────────┘
```

</div>

**نقاط حیاتی ایزوله‌سازی:**

```python
class TenantContext:
    tenant_id: str
    user_id: str
    tier: str  # "starter" | "pro" | "enterprise"
    
    def __enter__(self):
        # Set tenant context for all downstream calls
        _tenant_context.set(self)
        
    def __exit__(self, *args):
        _tenant_context.set(None)

# Middleware ensures tenant context on every request
@middleware
def enforce_tenant_context(request, call_next):
    tenant_id = extract_tenant_from_token(request.headers["Authorization"])
    with TenantContext(tenant_id=tenant_id, ...):
        verify_tenant_access(tenant_id, request.path)
        response = call_next(request)
        add_tenant_to_audit_log(tenant_id, request, response)
    return response
```

**محاسبه صورت‌حساب و رهگیری مصرف:**

```python
usage_schema = {
    "tenant_id": "string",
    "timestamp": "datetime",
    "operation": "embed|retrieve|generate",
    "model": "string",
    "tokens_in": "int",
    "tokens_out": "int",
    "region": "string",       # residency route; priced higher, see below
    "latency_ms": "int",
    "cost_cents": "decimal"
}

# Real-time usage aggregation
async def track_usage(tenant_id: str, operation: Usage):
    # Append to time-series DB
    await timeseries.write("usage", {
        "tenant_id": tenant_id,
        **operation.dict()
    })
    
    # Update real-time counter for rate limiting
    await redis.incr(f"usage:{tenant_id}:{today()}", operation.tokens)
```

**موقعیت داده‌ها (Residency) به عنوان یک سطح با قیمت‌گذاری مجزا:**

مستأجرهای سازمانی که به پردازش در یک منطقه جغرافیایی خاص نیاز دارند، هزینه سرویس‌دهی بالاتری دارند. شرکت Anthropic ضریب ۱.۱ برابری برای استنتاج صرفاً در خاک آمریکا (`inference_geo`) در مدل‌های Claude 4.6 به بعد دریافت می‌کند، OpenAI هزینه ۱۰ درصدی مازاد برای اندپوینت‌های اقامت داده‌ها برای مدل‌های پس از ۵ مارس ۲۰۲۶ اعمال می‌کند، و اندپوینت‌های منطقه‌ای کلود روی Bedrock و Google Cloud حدود ۱۰٪ هزینه بالاتری نسبت به اندپوینت‌های جهانی دارند (در پلتفرم Vertex گوگل، مدل‌های فعلی مانند Opus 5.5 و Sonnet 5.5 فقط اقامت چندمنطقه‌ای `us` یا `eu` را با این ضریب ارائه می‌دهند، نه یک منطقه منفرد؛ بخش [قیمت‌گذاری و هزینه‌ها](../02-model-landscape/03-pricing-and-costs.md) را ببینید). تنها مشتریانی را که قید اقامت دارند به مناطق پین‌شده هدایت کنید، مسیر انتخابی را در رکوردهای مصرف ثبت نمایید، و هزینه آن را در پکیج مشتری لحاظ کنید به جای اینکه ضریب مازاد را روی تمام ترافیک بپردازید.

---

## تمرین ۷: جستجوی معنایی در مقیاس بالا (Semantic Search at Scale)

### صورت مسئله

یک سیستم جستجوی معنایی برای یک فروشگاه آنلاین بزرگ طراحی کنید:

- ۵۰ میلیون محصول
- ۱۰۰ میلیون پرس‌وجو در روز
- تاخیر p99 زیر ۱۰۰ میلی‌ثانیه
- پشتیبانی از فیلترها (قیمت، دسته‌بندی، برند، امتیاز کاربران)
- شخصی‌سازی نتایج بر پایه تاریخچه کاربر
- به‌روزرسانی بلادرنگ موجودی کالاها

### نکات برجسته راه‌حل

**چالش کلیدی: تاخیر ۱۰۰ میلی‌ثانیه در ۱۰۰ میلیون پرس‌وجوی روزانه**

```
100M queries/day = 1,157 QPS average
Peak: 5,000-10,000 QPS

At 100ms latency, need:
- Edge caching
- Pre-computed embeddings
- Optimized retrieval
- Minimal LLM involvement
```

**معماری سیستم:**
<div dir="ltr">

```
┌────────────────────────────────────────────────────────────┐
│                         CDN/Edge                            │
│              (Cache popular queries: ~30% hit)              │
└─────────────────────────────┬──────────────────────────────┘
                               │
┌─────────────────────────────▼──────────────────────────────┐
│                      Query Service                          │
│  1. Embed query (cached embeddings for common queries)      │
│  2. Retrieve candidates (ANN search)                        │
│  3. Apply filters (post-filter or hybrid)                   │
│  4. Personalize ranking                                     │
│  5. Return results                                          │
└─────────────────────────────┬──────────────────────────────┘
                               │
┌─────────────────────────────▼──────────────────────────────┐
│                    Vector Database Cluster                  │
│  - Sharded by category (reduce search space)                │
│  - HNSW index with ef_search tuned for speed                │
│  - Metadata filtering with roaring bitmaps                  │
└────────────────────────────────────────────────────────────┘
```

</div>

**بودجه تاخیر:**

<div dir="ltr">

```
Edge cache check:    5ms
Embedding lookup:   10ms (cached) or 30ms (compute)
Vector search:      30ms
Filtering:          10ms
Personalization:    10ms
Serialization:      10ms
Network overhead:   25ms
─────────────────────
Total:              100ms target (with cache hit)
```

</div>

**استراتژی جستجوی ترکیبی (Hybrid Search):**

```python
def search(query: str, filters: dict, user_id: str) -> List[Product]:
    # Determine search strategy based on query
    if is_keyword_heavy(query):
        # "nike air max 90 size 10"
        sparse_weight = 0.7
        dense_weight = 0.3
    else:
        # "comfortable running shoes for flat feet"
        sparse_weight = 0.3
        dense_weight = 0.7
    
    # Parallel retrieval
    dense_results = vector_db.search(embed(query), top_k=100, filter=filters)
    sparse_results = elastic.search(query, top_k=100, filter=filters)
    
    # Reciprocal rank fusion
    combined = rrf_merge(
        [dense_results, sparse_results],
        weights=[dense_weight, sparse_weight]
    )
    
    # Personalization boost
    personalized = apply_user_preferences(combined, user_id)
    
    return personalized[:20]
```

**به‌روزرسانی‌های بلادرنگ:**

```
Product updates (price, inventory) flow:
1. Change event published to Kafka
2. Consumer updates vector DB metadata
3. Search reflects change within seconds

Reindexing (description changes):
1. Full re-embed required
2. Run as async job
3. Swap index when complete
```

---

## تمرین ۸: پایپ‌لاین ارزیابی برای یک محصول LLM در محیط عملیاتی

### صورت مسئله

«شرکت شما یک دستیار هوش مصنوعی با ۵۰,۰۰۰ کاربر فعال روزانه ارائه می‌دهد. مدیران شرکت می‌خواهند تغییرات مدل و پرامپت را به‌صورت هفتگی بدون افت کیفیت (Regression) عرضه کنند. پایپ‌لاین ارزیابی را طراحی کنید: ارزیابی‌های آفلاین، گیت‌های کنترل CI/CD، کالیبراسیون قاضی (Judge)، و مانیتورینگ در محیط عملیاتی. بودجه: کل هزینه سیستم ارزیابی باید زیر ۲٪ از کل هزینه استنتاج سیستم باشد.»

### سؤالات شفاف‌کننده که باید بپرسید

- «کیفیت» برای این محصول چه تعریفی دارد؟ (موفقیت در انجام کار، وفاداری به منبع، لحن بیان، ایمنی؟)
- آیا داده‌های برچسب‌گذاری‌شده در حال حاضر وجود دارند یا باید از صفر شروع کنیم؟
- نرخ و سرعت اعمال تغییرات چقدر است؟ (پرامپت‌ها روزانه، مدل‌ها ماهانه؟)
- هزینه و پیامد انتشار یک نسخه دارای پسرفت کیفی چیست؟ (تیکت‌های پشتیبانی، ریزش مشتریان، پیامدهای قانونی؟)
- چه کسانی نتایج ارزیابی را مصرف می‌کنند؟ (مهندسان برای مرج کردن PR، مدیران محصول برای پیگیری کیفیت، مدیران ارشد برای بررسی نمودارها؟)

### راهنمای گام‌به‌گام راه‌حل

**معماری در سطح بالا:**
<div dir="ltr">

```
                    ┌────────────────────────────────────────────┐
                    │              EVAL PIPELINE                  │
                    │                                             │
  Prompt/model PR ──► CI runner ── dev set (visible, ~200 cases) │
                    │     │                                       │
                    │     ├── held-out set (CI-only, ~300 cases,  │
                    │     │    rotated quarterly)                  │
                    │     │                                       │
                    │     └── gate: pass/fail vs baseline ──► merge│
                    │                                             │
  Production ──────► sampler (1-5% of traffic)                   │
                    │     │                                       │
                    │     ├── LLM-judge scoring (async, cheap)    │
                    │     ├── human-graded slice (weekly, ~100)   │
                    │     └── outcome metrics (thumbs, escalation)│
                    │                                             │
                    └──── dashboards + regression alerts ─────────┘
```

</div>

**۱. استراتژی مجموعه داده (بخشی که بیشتر داوطلبان نادیده می‌گیرند):**

```
Golden dataset composition:
- 40% sampled from real production traces (stratified by intent cluster)
- 30% known-hard cases from past incidents and complaints
- 20% adversarial cases (injection attempts, edge formats)
- 10% canary cases that must never change behavior

Split: dev (iterate freely) / held-out (CI-only, never inspected)
Refresh: quarterly, sampled from recent traffic; archive old sets
```

**۲. طراحی امتیازدهی (Scoring):**

- استفاده از تایید/رد دودویی (Binary pass/fail) برای هر بعد کیفی (وفاداری، جامعیت، لحن، ایمنی)، نه مقیاس‌های ۱ تا ۵. تصمیمات باینری قابل تکرار هستند؛ مقیاس‌های لیکرت دچار لغزش و بی‌ثباتی می‌شوند.
- استفاده از LLM-as-judge برای مقیاس‌پذیری: یک مدل ارزان‌قیمت (GPT-6 Luna، Gemini 3.8 Flash، Claude Haiku 5.5) همراه با یک شیوه‌نامه ارزیابی و مثال‌های لنگری (Few-shot anchors) برای هر بعد. از آنجا که ابعاد دودویی هستند، یک مدل تصمیم‌گیری (مانند Decisions API شرکت OpenAI؛ بخش [مدل‌های تصمیم‌گیری](../RESEARCH-RADAR.md#16-decision-models-typed-answers-with-probabilities) را ببینید) گزینه‌ای ارزان‌تر برای سناریوهای شفاف است. این مدل توضیحی نمی‌دهد و احتمالات آن مانند هر قاضی دیگری باید با نمونه انسانی کالیبره شود.
- کالیبراسیون قاضی: بررسی ماهانه نرخ توافق با نمونه بررسی‌شده توسط انسان. نرخ توافق قاضی و انسان خودش یک متریک در داشبورد است؛ زیر ۸۵٪ توافق، ابتدا پرامپت قاضی اصلاح می‌شود و سپس نتیجه‌گیری محصولی صورت می‌گیرد.

**۳. گیت‌های کنترلی CI/CD:**

```python
def eval_gate(pr_results, baseline_results):
    # Hard gates: any safety regression blocks merge
    if pr_results.safety_pass_rate < baseline_results.safety_pass_rate:
        return Block(reason="safety regression")
    # Soft gates: quality within noise band
    delta = pr_results.task_success - baseline_results.task_success
    if delta < -0.02:                  # 2pt regression threshold
        return Block(reason=f"quality drop {delta:.1%}")
    if pr_results.held_out_success < pr_results.dev_success - 0.05:
        return Warn(reason="possible dev-set overfitting")
    return Pass()
```

**۴. مانیتورینگ در محیط عملیاتی:**

- نمونه‌برداری و نمره‌دهی قاضی روی ۱ تا ۵ درصد از ترافیک زنده و ثبت روند روزانه.
- اتصال به پیامدهای محصولی: نرخ نارضایتی، نرخ دیس‌لایک و نرخ ارجاع به اپراتور در همان داشبورد در کنار نمرات ارزیابی رسم می‌شوند. انحراف میان روند ارزیابی و پیامدهای واقعی، بازبینی پایپ‌لاین ارزیابی را کلید می‌زند.
- هشدارهای انحراف و تغییر توزیع: جابه‌جایی در توزیع ورودی‌ها، افت امتیاز در بخش‌های خاص، و افت سازگاری قاضی.

**۵. کنترل هزینه‌ها:**

```
50K DAU, ~3 requests each = 150K requests/day
Sample 2% = 3K judged requests/day
Judge cost: ~1K tokens per judgment on a $1/1M model = ~$3/day
Weekly human slice: 100 cases x 3 min reviewer time
CI runs: 500 cases x ~2K tokens per PR = under $2 per PR
Total: well under the 2% budget; the human slice is the
dominant cost and it is what keeps the judge honest.
```

**۶. ابزارها و قابلیت حمل (Portability):**

مجموعه‌های داده، شیوه‌نامه‌ها، پرامپت‌های قاضی و آستانه‌های گیت را در مخزن اختصاصی خود نگه دارید و با پلتفرم‌های هاست‌شده ارزیابی به عنوان ابزارهای اجرای قابل تعویض برخورد کنید. سرویس ارزیابی ابری OpenAI در ۳۰ نوامبر ۲۰۲۶ خاموش می‌شود (و کاربران را به Promptfoo هدایت می‌کند)، و سرویس ابری LangSmith لاگ‌ها را حداکثر ۱۸۰ روز نگه می‌دارد. برای ثبت روندهای چندفصلی به یک پایگاه داده تحت کنترل خودتان نیاز دارید.

### ویژگی‌های متمایزکننده داوطلبان برتر

- آن‌ها پیش از مدل نمره‌دهنده، مجموعه داده را طراحی می‌کنند؛ یک قاضی فوق‌العاده روی داده‌های قدیمی هیچ چیز معناداری را نمی‌سنجد.
- با قاضی به عنوان یکی از اجزای سیستم که خودش نیاز به ارزیابی دارد برخورد می‌کنند، نه به عنوان مرجع حقیقت مطلق.
- ریسک‌های دور زدن و تقلب در ارزیابی را خودشان نام می‌برند: بیش‌برازش روی داده‌های توسعه، تملق قاضی، باریک شدن بیش‌از‌حد معیارها، و حذف پنهان موارد دشوار.
- مجموعه داده پنهان (Held-out) و پاسخ‌های مرجع را از دسترس سیستم تحت آزمایش دور نگه می‌دارند. Agentهای دارای ابزار پاسخ‌ها را پیدا می‌کنند: حسابرسی سپتامبر ۲۰۲۶ (arXiv 2609.34262) نشان داد بین ۲۴ تا ۷۳ درصد از مسیرهای موفق در SWE-Bench Pro v1.0 غیرواقعی بودند، عمدتاً از طریق بررسی تاریخچه گیت که پاسخ‌های مرجع را لو می‌داد.
- نمرات آفلاین را به پیامدهای محیط عملیاتی متصل می‌کنند، نه اینکه صرفاً به سبز بودن داشبوردها دلخوش باشند.
- بودجه ارزیابی را به‌صورت کمّی محاسبه می‌کنند و ارزیابی گران‌قیمت انسانی را در نقطه‌ای قرار می‌دهند که بالاترین اهرم و اثرگذاری را دارد.

---

## تمرین ۹: حافظه و وضعیت برای یک Agent با اجرای طولانی‌مدت

### صورت مسئله

«سیستم حافظه را برای یک دستیار هوش مصنوعی شخصی طراحی کنید که ماه‌ها با یک کاربر کار می‌کند: باید ترجیحات و حقایق را به خاطر بسپارد، از جلسات گذشته بیاموزد، تاریخچه مرتبط را در لحظات مناسب فرابخواند، و آنچه را که نباید نگه دارد فراموش کند. جلسات گفتگو ممکن است ساعت‌ها طول بکشند. سیستم باید ۱ میلیون کاربر را پشتیبانی کند.»

### سؤالات شفاف‌کننده که باید بپرسید

- کدام خطای حافظه آسیب بیشتری می‌زند: فراموش کردن یک موضوع مهم، یا به یاد آوردن یک داده غلط یا تاریخ‌گذشته؟
- محدودیت‌های حریم خصوصی چیست؟ (حذف مبتنی بر GDPR، ایزوله‌سازی کاربر، داده‌های تحت قوانین خاص؟)
- آیا حافظه صرفاً مختص هر کاربر است یا دانش مشترک سازمانی نیز وجود دارد؟
- بودجه تاخیر برای بازیابی حافظه در هر دور گفتگو چقدر است؟
- هر جلسه گفتگو چقدر طول می‌کشد؟ (طراحی درون‌سشن در برابر بین‌سشن را تعیین می‌کند.)

### راهنمای گام‌به‌گام راه‌حل

**سلسله‌مراتب حافظه:**
<div dir="ltr">

```
┌──────────────────────────────────────────────────────────┐
│ L1 Working memory: the context window                     │
│   Current session, tool results, scratchpad               │
│   Managed by compaction + just-in-time loading            │
├──────────────────────────────────────────────────────────┤
│ L2 Episodic memory: what happened                         │
│   Past session summaries, trajectories, outcomes          │
│   Store: vector DB, retrieved by similarity + recency     │
├──────────────────────────────────────────────────────────┤
│ L3 Semantic memory: what is true                          │
│   Extracted facts and preferences with provenance         │
│   Store: structured records or knowledge graph            │
├──────────────────────────────────────────────────────────┤
│ L4 Procedural memory: how to do things                    │
│   Learned workflows, per-user playbooks (skills)          │
│   Store: versioned files, loaded on demand                │
└──────────────────────────────────────────────────────────┘
```

</div>

**۱. درون جلسه (سطح L1): مهندسی کانتکست، نه ذخیره‌سازی.**
فشرده‌سازی در یک آستانه مشخص پنجره (خلاصه‌سازی تاریخچه، حفظ خروجی‌های مهم اخیر)، بارگذاری در لحظه اسناد حجیم با ارجاع به آن‌ها، و یادداشت‌های ساختاریافته که Agent پس از فشرده‌سازی مجدداً می‌خواند. جلسه‌ای که ساعت‌ها طول می‌کشد هرگز کل متن گفتگو را در کانتکست نگه نمی‌دارد.

**۲. مسیر نوشتن در حافظه (بخش دشوار مسئله):**
<div dir="ltr">

```
Session ends (or hits checkpoint)
    │
    ├── Summarize episode → L2 (embedding + metadata:
    │     timestamp, topics, outcome, sentiment)
    │
    └── Fact extraction pass → candidate facts
          │
          ├── Deduplicate against existing L3
          ├── Conflict check: contradicts a stored fact?
          │     ├── Newer + higher confidence → supersede (keep old
          │     │     version with valid_to timestamp)
          │     └── Ambiguous → store as candidate, confirm with
          │           user at next natural opportunity
          └── Importance filter: discard chit-chat, keep
                preferences, commitments, corrections
```

</div>

مسیر حل تعارض بیشترین اهمیت را دارد: گزاره «کاربر از مادرید به لیسبون نقل مکان کرد» باید جایگزین داده قبلی شود، نه اینکه هر دو هم‌زمان باقی بمانند. استفاده از رکوردهای دوگانه زمانی (valid_from و valid_to) فرآیند جایگزینی را قابل ممیزی و برگشت‌پذیر می‌کند.

**۳. مسیر خواندن از حافظه:**

- در هر دور گفتگو، یک پرس‌وجوی یادآوری از نیت فعلی ساخته می‌شود، برترین موارد از سطح L2 (با ترکیب شباهت، تازگی زمانی و اهمیت) و حقایق منطبق از سطح L3 بازیابی می‌شوند.
- یک گیت سنجش ارتباط، موارد با شباهت ضعیف را حذف می‌کند؛ خاطرات غلط بسیار بیشتر از نبود خاطره پاسخ را مسموم می‌کنند.
- بودجه یادآوری: چند صد توکن حافظه در هر دور گفتگو، نه ریختن کل سوابق در پرامپت.
- مقایسه حالت «حافظه فعال» در برابر «بدون حافظه»: بنچمارک MemTrapBench (اوت ۲۰۲۶) نشان داد تمام استراتژی‌های حافظه در تسک‌های تله‌دار عملکردی ضعیف‌تر از حالت بدون حافظه داشتند، زیرا خاطرات درست اما نامتناسب، Agent را دچار تثبیت استدلال نادرست می‌کردند.

**۴. فراموشی و حریم خصوصی:**

- زوال زمانی (Decay): رکوردهای رویدادی با گذشت زمان وزن بازیابی خود را از دست می‌دهند مگر اینکه با دسترسی‌های جدید تقویت شوند.
- ادغام و یکپارچه‌سازی: یک جاب دوره‌ای گفتگوهای مرتبط را در خلاصه‌ها ادغام می‌کند. شرکت‌ها اکنون این قابلیت را تحت عنوان فرآیند آفلاین «رویاپردازی (Dreaming)» عرضه می‌کنند (مانند Dreams در Anthropic و Dream در Mem0).
- حذف داده مبتنی بر GDPR: کلیدهای پارتیشن مجزا برای هر کاربر؛ حذف کردن موجب پاک شدن ردیف‌های L2/L3/L4 و ابطال کش‌ها می‌شود. حافظه هرگز بر اساس شباهت معنایی میان مستأجرها به اشتراک گذاشته نمی‌شود.

**۵. تخمین مقیاس (برای ۱ میلیون کاربر):**

```
Storage: ~thousands of L2 entries + hundreds of L3 facts per
  active user; vector DB partitioned by user_id (metadata
  filter or namespace per tenant tier)
Write path: async after session close; queue + worker pool
Read path: p95 < 150ms recall (ANN on a per-user slice is small)
Cost: extraction pass on session close is the main LLM cost;
  use a cheap model (GPT-6 Luna, Gemini 3.8 Flash, or DeepSeek
  V4.1-Flash) with a strict schema
```

### ویژگی‌های متمایزکننده داوطلبان برتر

- تفکیک شفاف میان مدیریت کانتکست درون جلسه و حافظه بلندمدت میان جلسات مختلف.
- صرف زمان کافی روی مسیر نوشتن (استخراج، حذف تکرارها، حل تعارضات) به جای تمرکز صرف روی بازیابی.
- برخورد با یادآوری غلط به عنوان خطایی مخرب‌تر از به یاد نیاوردن، و طراحی گیت ارتباط بر این اساس.
- توجه به مسموم‌سازی حافظه به عنوان یک سطح حمله امنیتی: محتوای غیرقابل‌اعتمادی که امروز ذخیره می‌شود نباید فردا کورکورانه مورد اعتماد قرار گیرد.
- آگاهی از ابزارهای آماده و محدودیت‌های آن‌ها: فریم‌ورک متن‌باز Mem0 از نسخه ۲.۰ صرفاً عملیات افزودن (ADD-only) را پشتیبانی می‌کند و ادغام و جایگزینی را به سرویس پولی برده است؛ بنابراین کد حل تعارض باید در برنامه خودتان پیاده شود. فریم‌ورک Letta نیز سرور قدیمی خود را آرشیو کرده و بر پایه فایل‌های Markdown در گیت بدون نمایه برداری کار می‌کند.

---

## تمرین ۱۰: سرویس Batching در استنتاج روی یک GPU منفرد

### صورت مسئله

«لایه Batching را برای یک سرویس استنتاج LLM روی یک GPU منفرد طراحی کنید. کاربران به‌صورت همگام (Synchronous) منتظر نتایج می‌مانند و هر بچ حداکثر ۱۰۰ دنباله (Sequence) را در خود جای می‌دهد. نحوه پذیرش، دسته‌بندی، زمان‌بندی و بازگرداندن نتایج را شرح دهید، و سپس توضیح دهید هنگامی که ترافیک از ظرفیت یک GPU فراتر رود، معماری چگونه تغییر می‌کند.»

این پرسش در مصاحبه‌های طراحی سیستم Anthropic گزارش شده است (گزارش‌های داوطلبان از طریق Aced، سپتامبر ۲۰۲۶). این تمرین نشان می‌دهد که آیا سرویس‌دهی را از درون درک می‌کنید یا صرفاً کار با APIها را بلدید.

### سؤالات شفاف‌کننده که باید بپرسید

- آیا تسک از نوع تولید خودبازگشتی (Autoregressive Generation) است یا یک اجرای منفرد (Forward pass مانند Embedding یا کلاس‌بندی)؟ این پاسخ کل معماری را تغییر می‌دهد.
- توزیع طول پرامپت و طول خروجی چگونه است؟ پرامپت‌های سنگین RAG و چت‌های طولانی در خروجی به بخش‌های مختلفی فشار می‌آورند.
- کدام SLO اهمیت دارد: زمان رسیدن به اولین توکن (TTFT)، تاخیر میان توکن‌ها، یا تاخیر سرتاسری، و در چه صدکی؟
- آیا کاربران استریمینگ دریافت می‌کنند یا منتظر کل پاسخ می‌مانند؟
- آیا اولویت‌بندی درخواست‌ها یا امکان انصراف کلاینت وجود دارد؟

### راهنمای گام‌به‌گام راه‌حل

**۱. دو حالت کاری، دو رویکرد Batching:**

```
Single forward pass (embed, classify, score):
  Dynamic batching. Flush when the batch reaches 100 OR the oldest
  request has waited max_wait (e.g. 5-10 ms). Added latency is
  bounded by max_wait; throughput comes from fuller batches.

Autoregressive generation:
  Static batching wastes the GPU: every slot waits for the longest
  sequence. Use continuous (iteration-level) batching: after each
  decode step, finished sequences leave and queued ones join.
```

**۲. معماری سیستم:**
<div dir="ltr">

```
Client ──► API (auth, validation, max_tokens cap)
              │
              ▼
        Admission control ── 429 + Retry-After when the queue is full
              │
              ▼
        Request queue (priority, deadline)
              │
              ▼
        Scheduler (runs every step)
          - admit while slots < 100 AND free KV blocks suffice
          - chunked prefill: split long prompts so they do not
            stall in-flight decodes
          - on KV pressure, preempt the lowest priority sequence
            (swap to host memory or recompute later)
              │
              ▼
        GPU worker: one forward pass per step over the mixed batch
              │
              ▼
        Detokenize and stream tokens back (SSE); free KV blocks on
        completion or client disconnect
```

</div>

**۳. محدودیت اصلی حافظه KV است، نه سقف اسمی ۱۰۰ درخواست:**

```
Llama 3.1 8B in BF16:
  2 × 32 layers × 8 KV heads × 128 head_dim × 2 bytes
  = 128 KiB of KV per token
80 GB GPU: ~16 GB of weights, leave ~50 GiB for KV ≈ 400K tokens

Average context 2K tokens → ~200 sequences fit: the 100 cap binds
Average context 8K tokens → ~50 sequences fit: memory binds first
```

بنابراین زمان‌بند بر مبنای بلوک‌های حافظه آزاد KV (مشابه تکنیک PagedAttention) درخواست‌ها را می‌پذیرد، فضایی را برای رشد توکن‌های خروجی رزرو می‌کند، و سقف ۱۰۰ درخواست در هر بچ را به عنوان سقف نهایی در نظر می‌گیرد، نه هدف.

**۴. کاربران همگام و کنترل فشار معکوس (Backpressure):**

- توکن‌ها را استریم کنید تا انتظار کاربر معادل TTFT باشد، نه کل زمان تولید.
- صف درخواست‌ها را از نظر تعداد درخواست و تعداد توکن‌های در صف محدود کنید و ترافیک مازاد را بلافاصله با خطای 429 پس بزنید. یک صف نامحدود در هنگام جهش ترافیک باعث تایم‌اوت شدن همه درخواست‌ها می‌شود. موتور vLLM فلگ‌های اختصاصی کنترل پذیرش را برای همین منظور در نسخه 0.29 اضافه کرد (`--max-num-queued-reqs` و `--max-num-queued-tokens`).
- با قطع اتصال کلاینت، عملیات را لغو کرده و بلوک‌های حافظه KV را آزاد کنید.
- برای هر درخواست سقف `max_tokens` تعیین کنید؛ یک درخواست سرکش می‌تواند حافظه را تا دقایق طولانی قفل کند.

**۵. متریک‌های کلیدی:**

متریک‌های TTFT و تاخیر بین توکن‌ها در صدک‌های p50 و p99، زمان انتظار در صف، نرخ اشغال بچ، ضریب مصرف KV، نرخ تعلیق (Preemption)، و مفهوم **توان مفید (Goodput)**: یعنی نرخ درخواستی که هم‌زمان به تعهدات سطح خدمت (SLO) در TTFT و تاخیر بین توکن‌ها پاسخ می‌دهد. ثبت رکورد توکن بر ثانیه در یک بچ پر، اگر منجر به رد شدن تعهدات p99 شود فاقد ارزش است.

**۶. فراتر از یک GPU:**

- استقرار کپی‌ها (Replicas) در پشت یک روتر آگاه از کش KV و پیشوند، تا درخواست‌هایی با پرامپت سیستمی مشترک به گره‌هایی بروند که پیشوند در آنجا از قبل کش شده است.
- تفکیک استخرهای Prefill و Decode هنگامی که پرامپت‌ها طولانی هستند. البته انتقال KV cache روی شبکه رایگان نیست (حدود ۳ گیگابایت برای پرامپت ۱۰ هزار توکنی در مدل Llama 3.1 70B در فرمت BF16 حدود ۶۵ میلی‌ثانیه زمان می‌برد)، بنابراین تنها زمانی صرفه دارد که Goodput کلی را افزایش دهد.
- رمزگشایی حدسی (Speculative decoding با روش‌هایی مثل EAGLE-3، MTP و روش‌های انتشار بلوکی نظیر DFlash) برای کاهش تاخیر بین توکن‌ها.

### ویژگی‌های متمایزکننده داوطلبان برتر

- پیش از کشیدن دیاگرام می‌پرسند آیا بار کاری از نوع تولید متن است یا یک Forward pass منفرد.
- حافظه KV را با ارقام مشخص محاسبه کرده و پذیرش را بر مبنای حافظه مدیریت می‌کنند نه تعداد اسلات‌ها.
- صف را محدود کرده و رفتار سیستم تحت بار شدید را شرح می‌دهند.
- گزارش عملکرد را بر مبنای Goodput در یک SLO معین ارائه می‌دهند، نه حداکثر توان اسمی خام.
- بیان می‌کنند که در محیط عملیاتی از vLLM یا SGLang استفاده خواهند کرد و نشان می‌دهند عملکرد درونی این موتورها را می‌فهمند.
- با موتور استنتاج به عنوان یک محیط با سرنوشت مشترک برخورد می‌کنند؛ ورودی‌ها باید قبل از رسیدن به GPU اعتبارسنجی شوند (یک درخواست مخرب به اندپوینت embedding در vLLM موتور را تا ریستارت کرش می‌داد؛ آسیب‌پذیری CVE-2026-93592). کش اشتراکی پیشوند نیز یک کانال جانبی بین‌مستأجری است، بنابراین از کلیدهای تفکیک‌شده (مانند `cache_salt` در vLLM) استفاده کنید.

---

## نکاتی برای تمرین‌های تخته‌سفید

### نکات رسم دیاگرام

۱. **ابتدا جعبه‌ها و برچسب‌ها را رسم کنید** و سپس آن‌ها را با فلش‌ها متصل نمایید.
۲. **از نمادهای استاندارد و منسجم استفاده کنید**: مستطیل برای سرویس‌ها، استوانه برای پایگاه‌های داده، فلش برای جریان داده‌ها.
۳. **داده‌های عبوری روی فلش‌ها را نام‌گذاری کنید**: مشخص کنید چه داده‌ای میان اجزا جابه‌جا می‌شود.
۴. **فضای خالی بگذارید** تا در حین بحث بتوانید اجزای جدیدی به آن اضافه کنید.

### الگوهای رایج که باید بشناسید

| الگو | زمان استفاده | نحوه رسم |
|---------|-------------|---------|
| سامانه Load Balancer + ناوگان سرویس‌ها | هر سرویس نیازمند مقیاس | توزیع‌کننده بار LB ← چند جعبه سرویس |
| صف + کارگران (Queue + Workers) | پردازش‌های ناهمگام (Async) | صف ← استخر کارگران |
| لایه کش (Cache) | بارهای کاری با خواندن بالا و حساس به تاخیر | لوزی قبل از سرویس |
| تغییر داده در لحظه (CDC / Streaming) | به‌روزرسانی‌های بلادرنگ | آیکون کافکا یا جریان |
| سایدکار (Sidecar) | دغدغه‌های مشترک زیرساختی | جعبه کوچک متصل به سرویس |

### عباراتی که نشانه داوطلبان مسلط است

- «پیش از طراحی، مایلم مقیاس سیستم را شفاف‌تر بدانم...»
- «موازنه (Tradeoff) کلیدی در این قسمت عبارت است از...»
- «در محیط عملیاتی (production)، به این مولفه‌ها نیز نیاز خواهیم داشت...»
- «یکی از حالت‌های شکست مهمی که باید لحاظ کنیم این است که...»
- «اجازه دهید بودجه تاخیر (Latency Budget) را با هم مرور کنیم...»
- «برای ارزیابی، این متریک‌ها را اندازه‌گیری خواهم کرد...»

### مدیریت زمان

- بیش از ۵ دقیقه را صرف سؤالات شفاف‌کننده اولیه نکنید.
- تصویر کامل سیستم را در سطح بالا رسم کنید، سپس به سراغ بررسی عمیق بروید.
- حتماً برای قابلیت اطمینان، پایداری و ارزیابی زمان باقی بگذارید.
- به‌طور مداوم با مصاحبه‌کننده هماهنگ شوید و نظر او را جویا شوید.

### تمرین با حضور فردی که زمان را مدیریت کند

تمرین انفرادی به پوشش ضعف‌های دانشی کمک می‌کند؛ اما سرعت بیان، حاشیه‌روی‌ها یا وسواس دفاع از نظر را اصلاح نمی‌کند. حداقل یک تمرین را از ابتدا تا انتها با فردی که نقش مصاحبه‌کننده را بازی می‌کند انجام دهید. اگر به دنبال یک مصاحبه‌کننده باتجربه همراه با بازخورد مکتوب هستید، می‌توانید یک جلسه مصاحبه آزمایشی با Om در [EngineBogie](https://enginebogie.com/u/ombharatiya) یا [Topmate](https://topmate.io/ombharatiya) رزرو کنید.

---

*همچنین ببینید: [بانک سؤالات](01-question-bank.md) | [چارچوب‌های پاسخ‌دهی](02-answer-frameworks.md) | [خطاهای متداول](03-common-pitfalls.md)*

</div>
