<div dir="rtl">

# خطاهای متداول در مصاحبه‌های طراحی سیستم‌های هوش مصنوعی (AI System Design)

این فصل اشتباهات پرتکراری را که داوطلبان در مصاحبه‌های طراحی سیستم‌های هوش مصنوعی مرتکب می‌شوند، چرایی آسیب زدن آن‌ها به ارزیابی شما و نحوه اجتناب از آن‌ها را پوشش می‌دهد.

## جدول محتوا

- [خطاهای معماری](#architecture-pitfalls)
- [خطاهای دانش فنی](#technical-knowledge-pitfalls)
- [خطاهای ارتباطی](#communication-pitfalls)
- [خطاهای استراتژی مصاحبه](#interview-strategy-pitfalls)
- [خطاهای خاص هوش مصنوعی](#ai-specific-pitfalls)
- [چک‌لیست‌های ارزیابی شخصی](#checklists-for-self-review)

---

## خطاهای معماری (Architecture Pitfalls)

### خطای ۱: نادیده گرفتن پایپ‌لاین داده (Data Pipeline)

**چه اشتباهی رخ می‌دهد:**
داوطلبان مسیر استنتاج (Inference) را با تمام جزئیات طراحی می‌کنند اما اشاره‌ای به نحوه ورود داده‌ها به سیستم نمی‌کنند.

**چرا اهمیت دارد:**
کیفیت داده محرک اصلی کیفیت سیستم‌های هوش مصنوعی است. یک معماری RAG فوق‌العاده اگر پایپ‌لاین ورود اسناد (Ingestion) آن Chunkهای بی‌کیفیت و معیوب تولید کند، کاملاً بی‌فایده خواهد بود.

**آنچه مصاحبه‌کنندگان متوجه آن می‌شوند:**
- عدم اشاره به نحوه پردازش اسناد
- فرض اینکه Embeddingها به‌صورت جادویی خودشان پدیدار می‌شوند
- نادیده گرفتن فرآیندهای به‌روزرسانی و حذف اسناد

**رویکرد بهتر:**
```
"Before discussing retrieval, let me walk through the data pipeline:

1. Document ingestion: File upload, API integration, crawler
2. Preprocessing: Format conversion, cleaning, metadata extraction
3. Chunking: [Strategy] based on document structure
4. Embedding: Batch processing with [model]
5. Indexing: Upsert to vector database with metadata
6. Updates: Incremental re-indexing on document changes"
```

---

### خطای ۲: انتخاب مدل با رویکرد یکسان برای همه (One-Size-Fits-All)

**چه اشتباهی رخ می‌دهد:**
داوطلبان ادعا می‌کنند که از یک مدل، معمولاً بزرگ‌ترین مدل پیشرویی (frontier model) که می‌شناسند، برای همه وظایف استفاده خواهند کرد.

**چرا اهمیت دارد:**
وظایف مختلف نیازمندی‌های متفاوتی دارند. استفاده از یک مدل frontier برای کلاس‌بندی (Classification) اتلاف هزینه است. از سوی دیگر استفاده از یک مدل کوچک برای استدلال‌های پیچیده شکست خواهد خورد.

**آنچه مصاحبه‌کنندگان متوجه آن می‌شوند:**
- عدم بحث پیرامون پیامدهای هزینه
- عدم توجه به الزامات تاخیر (Latency)
- عدم استفاده از الگوهای آبشاری مدل (Cascade) یا مسیریابی (Routing)

**رویکرد بهتر:**
```
"Model selection varies by task:

- Intent classification: Fine-tuned BERT-class encoder or GPT-6 Luna
- Simple responses: GPT-6 Luna, Gemini 3.8 Flash, DeepSeek V4.1-Flash,
  or Claude Haiku 5.5 (short prompts; it reprices above 100K tokens)
- Complex reasoning: Claude Sonnet 5.5 or GPT-6.1 Sol
- Code generation: Claude Sonnet 5.5 or GPT-6.1 Sol, with Claude Opus 5.5
  for the hardest cases (Fable 5.1 or GPT-6 Astra only where evals
  show the ceiling matters)

I would implement a router that classifies query complexity 
and routes to the appropriate model. This typically reduces 
costs 60-70% with minimal quality impact."
```

---

### خطای ۳: نادیده گرفتن لایه ارزیابی (Evaluation)

**چه اشتباهی رخ می‌دهد:**
داوطلبان نحوه ساخت سیستم را شرح می‌دهند، اما توضیحی نمی‌دهند که چگونه متوجه درست کار کردن آن می‌شوند.

**چرا اهمیت دارد:**
سیستم‌های هوش مصنوعی به‌شیوه‌های نامحسوس و پنهان دچار شکست می‌شوند. بدون ارزیابی، سیستم‌های معیوب را به محیط عملیاتی مستقر (Deploy) می‌کنید و هرگز متوجه افت کارایی آن نخواهید شد.

**آنچه مصاحبه‌کنندگان متوجه آن می‌شوند:**
- عدم اشاره به مجموعه داده آزمون (Test set)
- تعریف نکردن متریک‌های کیفی
- فقدان مانیتورینگ برای شناسایی مشکلات محیط عملیاتی (production)

**رویکرد بهتر:**
```
"Evaluation has three layers:

1. Offline: Golden test set evaluated on every change
   - Retrieval: Precision@5, Recall@5, MRR
   - Generation: Faithfulness, relevance (RAGAS)
   - End-to-end: Answer correctness vs ground truth

2. Online: Sampled evaluation in production
   - LLM-as-judge on 5% of requests
   - User feedback (thumbs up/down)
   - Completion rate for task-oriented queries

3. Alerting: Automated detection
   - Quality score drops below threshold
   - Latency exceeds SLA
   - Error rate spikes"
```

---

### خطای ۴: دست‌کم گرفتن پیچیدگی چندمستأجره (Multi-Tenancy)

**چه اشتباهی رخ می‌دهد:**
داوطلبان با سیستم RAG چندمستأجره مثل اضافه کردن ساده یک فیلد `tenant_id` برخورد می‌کنند.

**چرا اهمیت دارد:**
سیستم‌های هوش مصنوعی چندمستأجره حالت‌های شکست منحصربه‌فردی در زمینه نشت داده، ایزوله‌سازی، و تخصیص عادلانه منابع دارند.

**آنچه مصاحبه‌کنندگان متوجه آن می‌شوند:**
- فیلتر کردن پس از بازیابی (Post-retrieval filtering - یک پرچم قرمز بزرگ)
- عدم بحث پیرامون ایزوله‌سازی حافظه کش
- نادیده گرفتن مشکل همسایه پر سر و صدا (Noisy neighbor)

**رویکرد بهتر:**
```
"Multi-tenancy for RAG is harder than traditional systems:

1. Retrieval isolation: Filter BEFORE retrieval at the database level
   WRONG: retrieve(query, top_k=100) then filter by tenant
   RIGHT: retrieve(query, top_k=10, filter={tenant_id: X})

2. Context isolation: Never mix tenants in LLM context

3. Cache isolation: Scope all cache keys by tenant
   cache_key = f'{tenant_id}:{query_hash}'

4. Embedding isolation: Consider tenant-specific embedding spaces
   for highest security requirements

5. Audit: Log tenant context for all operations

I would also run regular isolation tests with adversarial 
queries designed to probe for cross-tenant leakage."
```

---

### خطای ۵: عدم وجود افت تدریجی و سازگار کارایی (Graceful Degradation)

**چه اشتباهی رخ می‌دهد:**
سیستم هیچ جایگزین یا راهکاری برای زمان‌هایی که ارائه‌دهنده LLM قطع است، با محدودیت نرخ مواجه شده یا خطاهای سیستمی بازمی‌گرداند، در نظر نگرفته است.

**چرا اهمیت دارد:**
ارائه‌دهندگان LLM دچار قطعی می‌شوند. صفحه وضعیت Anthropic حداقل ۱۲ حادثه عمده یا بحرانی را بین ۱۶ اوت و ۲۹ سپتامبر ۲۰۲۶ ثبت کرد و حادثه ۲۹ سپتامبر شرکت OpenAI باعث افت کارایی API، سرویس ChatGPT و Codex به مدت ۵ ساعت و ۲۰ دقیقه شد. محدودیت‌های نرخ رخ می‌دهند. مدیریت شکست، سیستم آماده برای محیط عملیاتی (production-ready) را از یک پیش‌نمایش یا پروتوتایپ جدا می‌کند.

**آنچه مصاحبه‌کنندگان متوجه آن می‌شوند:**
- عدم اشاره به راهکارهای Fallback
- عدم وجود استراتژی تلاش مجدد (Retry)
- وابستگی کامل به یک ارائه‌دهنده واحد

**رویکرد بهتر:**
```
"Reliability layers:

1. Retry with backoff: Transient errors get retried
   - Exponential backoff with jitter
   - Max 3 attempts

2. Fallback providers: If primary fails, try a different vendor
   (a second model from the same vendor usually shares the outage)
   - OpenAI → Anthropic → local model
   - Abstract the interface, but keep per-model request shapes:
     Opus 5.5, Sonnet 5.5, and Fable/Mythos 5.1 reject forced
     tool_choice (Haiku 5.5 accepts it but skips thinking), Claude
     API version 2026-10-21 rejects any temperature on every model,
     and GPT-6 Astra rejects temperature,
     so replaying one request body across providers returns 400s
   - Keep a tested prompt per fallback model

3. Cached responses: Return cached results for known queries
   - Exact match cache for repeated questions
   - Semantic cache for similar questions

4. Graceful degradation: Partial functionality on failure
   - Retrieval fails → return direct LLM response with disclaimer
   - LLM fails → return relevant chunks without synthesis

5. Circuit breaker: Fail fast when provider is degraded
   - Prevents cascading latency issues"
```

---

## خطاهای دانش فنی (Technical Knowledge Pitfalls)

### خطای ۶: اشتباه گرفتن مدل‌های Embedding با مدل‌های تولید متن (Generation)

**چه اشتباهی رخ می‌دهد:**
داوطلبان از تولید متن به وسیله مدل‌های Embedding صحبت می‌کنند یا با فرآیند تولید متن مانند بازیابی برخورد می‌نمایند.

**آنچه باید بدانید:**
- **مدل‌های Embedding:** نگاشت متن به بردار. برای جستجو و بازیابی (Retrieval) استفاده می‌شوند.
- **مدل‌های تولید متن (Generation models):** تولید متن بر اساس یک Prompt ورودی. برای پاسخ‌دهی استفاده می‌شوند.

**نحوه اتصال آن‌ها:**
سیستم RAG از مدل‌های Embedding برای بازیابی استفاده می‌کند، سپس Chunkهای بازیابی‌شده را به یک مدل تولید متن تحویل می‌دهد.

---

### خطای ۷: درک نادرست از پنجره‌های کانتکست (Context Windows)

**چه اشتباهی رخ می‌دهد:**
- فرض اینکه یک کانتکست ۱۲۸ هزار توکنی به معنی ۱۲۸ هزار توکن کانتکست مفید و کارآمد است.
- محاسبه نکردن پرامپت سیستمی (System prompt)، Chunkهای بازیابی‌شده و تاریخچه گفتگو.
- نادیده گرفتن پدیده «گم شدن در میانه» (Lost in the middle).

**آنچه باید بدانید:**
- پنجره کانتکست حداکثر ظرفیت است، نه هدف طراحی.
- توجه (Attention) مدل نسبت به محتوای قرارگرفته در میانه کانتکست تضعیف می‌شود.
- کانتکست مفید و کاربردی در عمل بسیار کوچک‌تر از سقف اسمی آن است.

**بیان بهتر:**
```
"While current frontier models advertise 1M-token windows, I design for much smaller effective context:

- System prompt: ~500 tokens
- Retrieved context: 3-5 chunks × 500 tokens = 1.5-2.5K
- Conversation history: Last 5 turns × 300 tokens = 1.5K
- Buffer for output: ~2K

Total active context: ~7K tokens, well below limit.

This keeps the model focused on relevant information and 
avoids the lost-in-the-middle problem documented in Liu et al."
```

---

### خطای ۸: عدم درک اقتصاد و هزینه‌های Token

**چه اشتباهی رخ می‌دهد:**
داوطلبان درباره قابلیت‌ها صحبت می‌کنند بدون اینکه درکی از پیامدهای مالی و هزینه داشته باشند.

**آنچه باید بدانید:**
- قیمت‌گذاری به ازای Token است و معمولاً قیمت توکن‌های ورودی (Input) و خروجی (Output) متفاوت است.
- هزینه توکن‌های خروجی معمولاً ۳ تا ۶ برابر توکن‌های ورودی است؛ ضریب ۵ برابر در لیست قیمت‌های فعلی مدل‌های Claude، GPT-6 و Gemini Flash استاندارد است.
- پرامپت‌های طولانی می‌توانند هزینه کل درخواست را تغییر دهند: OpenAI تمام توکن‌ها را در صورتی که ورودی از ۲۷۲ هزار توکن فراتر رود با نرخ کانتکست طولانی محاسبه می‌کند، xAI هزینه تمام توکن‌ها را در ۲۰۰ هزار توکن و بالاتر دو برابر می‌کند، و مدل Claude Haiku 5.5 هنگامی که پرامپت از ۱۰۰ هزار توکن فراتر رود هزینه کل درخواست را ۵ برابر محاسبه می‌کند (خواندن و نوشتن کش نیز در این سقف لحاظ می‌شود)، در حالی که قیمت‌گذاری Claude Opus 5.5 و Sonnet 5.5 تا ۱ میلیون توکن ثابت و خطی است.
- توکن‌های تفکر (Thinking tokens) به عنوان توکن خروجی محاسبه می‌شوند و تلاش پیش‌فرض در مدل‌های مختلف متفاوت است (مدل Claude Opus 5.5 روی `medium` و Sonnet 5.5 روی `high` در API)، بنابراین میزان تلاش استدلال را به‌صورت صریح برای هر مسیر تعیین کنید.
- استریمینگ (Streaming) تاثیری بر هزینه ندارد.

**مرجع سریع (قیمت‌های سطح استاندارد تا ۲ نوامبر ۲۰۲۶، قیمت‌های معرفی اولیه در صورت وجود ذکر شده‌اند؛ چندین مورد فقط در اکتبر تغییر کرده‌اند، بنابراین قبل از ذکر قیمت‌ها، [فصل قیمت‌گذاری](../02-model-landscape/03-pricing-and-costs.md) را بررسی کنید):**

| مدل | ورودی / ۱ میلیون | خروجی / ۱ میلیون | نکات مهم |
|-------|----------|-----------|-----------|
| Claude Fable 5.1 | $10 | $50 | نگهداری داده ۳۰ روزه؛ عدم نگهداری داده (Zero retention) تنها با تایید مستقیم Anthropic ممکن است |
| GPT-6 Astra | $10 | $50 | در ورودی‌های بالای ۲۷۲ هزار توکن، کل درخواست با نرخ $20 / $75 محاسبه می‌شود |
| Claude Opus 5.5 | $4 | $20 | نقطه شروع پیش‌فرض Anthropic؛ خواندن از کش $0.20 (ضریب 0.05x) |
| Claude Sonnet 5.5 | $2 | $10 | قیمت‌گذاری ثابت تا ۱ میلیون کانتکست؛ خواندن از کش $0.10 (ضریب 0.05x) از ۷ اکتبر |
| GPT-6.1 Sol | $2 | $10 | خواندن از کش $0.10 (ضریب 0.05x)؛ در بالای ۲۷۲ هزار توکن نرخ $4 / $15 |
| Gemini 4 Argon | $2 | $10 | تا ۳۰ نوامبر ۲۰۲۶؛ از ۱ دسامبر $4 / $20، پس بودجه‌بندی را بر مبنای $4 / $20 قرار دهید. فقط کش ضمنی (Implicit) |
| Grok 4.7 | $2 | $6 | پرامپت‌های بالای ۲۰۰ هزار توکن تمام توکن‌ها را با نرخ $4 / $12 محاسبه می‌کنند |
| GPT-6.1 Terra | $1 | $5 | در ورودی‌های بالای ۲۷۲ هزار توکن، کل درخواست با نرخ $2 / $7.50 محاسبه می‌شود |
| Gemini 3.8 Flash | $0.75 | $3.75 | قیمت معرفی تا ۳۱ دسامبر ۲۰۲۶؛ از ۱ ژانویه ۲۰۲۷ نرخ $1.50 / $7.50 |
| DeepSeek V4.1-Flash | $0.30 | $1.20 | نرخ ساعات اوج؛ ساعات غیراوج و آخر هفته‌ها نصف این مقدار است |
| Claude Haiku 5.5 | $0.10 | $0.50 | پرامپت‌ها تا ۱۰۰ هزار توکن؛ بالاتر از آن کل درخواست با نرخ $0.50 / $2.50 با احتساب خواندن و نوشتن کش محاسبه می‌شود. پارامتر `temperature` و پیش‌پُر کردن دستیار را نمی‌پذیرد |
| GPT-6 Luna | $0.10 | $0.50 | بالاتر از ۲۷۲ هزار توکن نرخ $0.20 / $0.75 |

**نمونه محاسبه هزینه:**
```
10,000 queries/day
Average: 2K input tokens, 500 output tokens
Model: Claude Sonnet 5.5

Daily cost = 10K × (2K × $2/1M + 500 × $10/1M)
          = 10K × ($0.004 + $0.005)
          = 10K × $0.009
          = $90/day = ~$2.7K/month
```

**اهرم کشینگ (عامل تمایز کلیدی بین داوطلبان):**
```
Same workload, but 1.5K of the 2K input is a shared prefix
(system prompt + tool schemas) served from cache at 5% of
the input price (Sonnet 5.5's cache read, $0.10/1M since October 7):

Daily cost = 10K × (0.5K × $2/1M + 1.5K × $0.10/1M + 500 × $10/1M)
          = 10K × ($0.001 + $0.00015 + $0.005)
          = $61.50/day = ~$1.85K/month   (about 32% saved by prompt shape alone)

Cache writes cost 1.25x ($2.50/1M for a 5-minute entry), but at ~7
requests a minute the prefix stays warm, so writes are noise.

Design implication: keep the static content (instructions, schemas)
at the front of the prompt and the dynamic content at the end, so
the prefix stays byte-identical across requests and the cache hits.
```

تخفیف خواندن از کش دیگر یک رقم ثابت ۱۰ درصدی نیست. اکثر مدل‌های Claude (از جمله Haiku 5.5) و مدل‌های GPT-5.6 به بعد OpenAI خواندن از کش را با ضریب 0.1x محاسبه می‌کنند؛ مدل‌های Claude Opus 5.5، Claude Sonnet 5.5، GPT-6.1 Sol و GPT-6.1 Terra با ضریب 0.05x؛ و Claude Fable 5.1 با ضریب 0.025x محاسبه می‌کنند. هزینه نوشتن در کش و طول عمر کش (TTL) نیز متفاوت است: OpenAI (مدل‌های GPT-5.6 به بعد) ضریب 1.25x برای نگهداری ۳۰ دقیقه‌ای و از ۲۰ اکتبر ۲۰۲۶ ضریب 2.5x برای نگهداری ۱۲ ساعته دریافت می‌کند، در حالی که Anthropic نگهداری ۵ دقیقه‌ای یا ۱ ساعته را با ضرایب 1.25x یا 2x ارائه می‌دهد، و Gemini 4 Argon تنها کش ضمنی دارد. در بارهای کاری سنگین Agent که وابستگی زیادی به کش دارند، این ضرایب می‌توانند بیش از قیمت پایه ورودی اهمیت داشته باشند.

---

### خطای ۹: درک سطحی از مولفه‌های RAG

**چه اشتباهی رخ می‌دهد:**
داوطلبان می‌توانند مولفه‌ها را نام ببرند (Chunking، ساخت بردار، بازیابی، تولید متن) اما قادر به توضیح موازنه‌ها (Tradeoffs) در هر یک نیستند.

**عمق مورد انتظار در فرآیند Chunking:**
- اصلاً چرا Chunking انجام می‌دهیم؟ (محدودیت‌های کانتکست، دقت بازیابی)
- موازنه‌های اندازه Chunk چیست؟ (اندازه کوچک‌تر = دقت بیشتر، اندازه بزرگ‌تر = کانتکست بیشتر)
- هدف از هم‌پوشانی (Overlap) چیست؟ (جلوگیری از قطع شدن کانتکست در مرزها)
- چه زمانی از Semantic Chunking استفاده کنیم؟ (اسناد پیچیده با ساختارهای متنوع)

**عمق مورد انتظار در بازیابی (Retrieval):**
- چرا جستجوی ترکیبی (Hybrid Search)؟ (روش متراکم یا Dense برای معنا و روش تنک یا Sparse برای کلیدواژه‌ها مناسب است)
- رتبه‌بندی مجدد (Reranking) چیست؟ (دو مرحله‌ای: فراخوانی سریع اولیه، سپس رتبه‌بندی دقیق)
- چگونه به عدم وجود نتیجه پاسخ دهیم؟ (استراتژی‌های Fallback)

---

### خطای ۱۰: برخورد جادویی با Promptها

**چه اشتباهی رخ می‌دهد:**
داوطلبان بدون اشاره به مهندسی پرامپت (Prompt Engineering)، صرفاً می‌گویند: «و سپس به مدل پرامپت می‌دهیم که...».

**آنچه مصاحبه‌کنندگان به دنبال آن هستند:**
- ساختار پرامپت (System، Context، User)
- وضوح و صراحت دستورالعمل‌ها
- تعیین دقیق فرمت خروجی
- استفاده از مثال‌های چند-نمونه (Few-shot) در صورت لزوم
- دفاع در برابر حالت‌های مرزی (Edge cases)

**رویکرد بهتر:**
```
"The generation prompt has this structure:

SYSTEM:
You are a support assistant for [Product]. Answer questions 
using ONLY the provided context. If the context does not 
contain the answer, say 'I don't have information about that.'
Always cite the source document.

CONTEXT:
[Retrieved chunks with source metadata]

USER:
[User's question]

I specify the output format explicitly and use few-shot 
examples for complex response structures. For this use case, 
I also include negative examples showing when to abstain."
```

**حالت‌های شکست پرامپت که ذکر آن‌ها در مصاحبه ارزشمند است:**

| حالت شکست | شکل ظاهری | نحوه دفاع |
|--------------|--------------------|---------|
| گم شدن در میانه (Lost in the middle) | دستورالعمل حیاتی مدفون در توکن ۴۰ هزار نادیده گرفته می‌شود | قوانین را در ابتدا و انتهای پرامپت قرار دهید؛ بخش میانی را به داده‌ها اختصاص دهید |
| شکست سلسله‌مراتب دستورات (Instruction hierarchy break) | متن سند بازیابی‌شده بر پرامپت سیستمی غلبه می‌کند | محتوای غیرقابل‌اعتماد را در جداکننده‌ها (Delimiters) قرار دهید؛ با آن به عنوان داده رفتار کنید، نه دستور |
| افت ساختار فرمت (Format slipping) | خروجی JSON در جلسات طولانی یا به‌روزرسانی‌های مدل به هم می‌ریزد | از خروجی‌های ساختاریافته در سطح موتور استنتاج (`json_schema`، اسکیماهای ابزار) استفاده کنید، نه درخواست متنی ساده |
| پویایی خراب‌کننده کش (Cache-busting dynamism) | وجود برچسب زمانی در بالای پرامپت کش پیشوند را در هر درخواست باطل می‌کند | محتوای ثابت در ابتدا، محتوای پویا در انتها |
| جفت‌شدگی پرامپت و مدل (Prompt-model coupling) | پرامپتی که برای یک مدل تنظیم شده، پس از تغییر مدل دچار افت پنهان کارایی می‌شود | پرامپت‌ها را با شناسه مدل نسخه‌گذاری کنید؛ با هر تغییر مدل، پایپ‌لاین ارزیابی (Eval) را اجرا نمایید |
| تغییر پیش‌فرض‌های پین‌نشده (Unpinned defaults) | ارتقای یک پکیج مدل یا میزان تلاش را تغییر می‌دهد: نسخه openai-agents 0.20 مدل پیش‌فرض را به `gpt-5.6-luna` تغییر داد، و پیش‌فرض Opus 5.5 تلاش `medium` است در حالی که Opus 5 از `high` استفاده می‌کرد | شناسه مدل و سطح تلاش را در تنظیمات پین کنید؛ ارتقای SDK و CLI را به عنوان تغییر مدل تلقی کنید که نیازمند اجرای مجدد ارزیابی‌هاست |

ذکر خودخواسته دو یا سه مورد از این حالت‌ها، سطح پاسخ‌دهی شما را از Junior به Senior ارتقا می‌دهد، چرا که هر یک از این موارد حوادثی در محیط عملیاتی هستند که احتمالاً مصاحبه‌کننده خود آن‌ها را تجربه کرده است.

---

## خطاهای ارتباطی (Communication Pitfalls)

### خطای ۱۱: مونولوگ گفتن بدون تعامل

**چه اشتباهی رخ می‌دهد:**
داوطلب ۱۰ تا ۱۵ دقیقه بدون هیچ بررسی و تعاملی با مصاحبه‌کننده به‌صورت یک‌نفس صحبت می‌کند.

**چرا اهمیت دارد:**
مصاحبه‌ها یک گفت‌وگوی دوطرفه هستند. مونولوگ گفتن باعث از دست رفتن نشانه‌ها درباره مواردی می‌شود که برای مصاحبه‌کننده اهمیت دارند.

**رویکرد بهتر:**
هر ۳ تا ۵ دقیقه یک‌بار با مصاحبه‌کننده همگام شوید:
- «آیا در بخش بازیابی عمیق‌تر شوم یا به سراغ بخش تولید متن بروم؟»
- «آیا این معماری کلی پیش از ورود به جزئیات منطقی به نظر می‌رسد؟»
- «آیا مولفه خاصی وجود دارد که بخواهید تمرکز بیشتری روی آن داشته باشم؟»

---

### خطای ۱۲: شروع نکردن با ساختار مشخص

**چه اشتباهی رخ می‌دهد:**
داوطلبان بدون مشخص کردن اینکه چه مواردی را پوشش خواهند داد شروع به صحبت می‌کنند.

**چرا اهمیت دارد:**
مصاحبه‌کنندگان در ذهن خود مدل‌های مشخصی دارند. اگر نتوانند پاسخ شما را با انتظاراتشان تطبیق دهند، شما نامنظم و آشفته به نظر خواهید رسید.

**رویکرد بهتر:**
پاسخ خود را با یک نقشه‌راه آغاز کنید:
```
"I will structure my answer in four parts:
1. High-level architecture
2. Deep dive on the RAG pipeline
3. Scaling and reliability
4. Evaluation approach

Let me start with the high-level architecture..."
```

---

### خطای ۱۳: استفاده از اصطلاحات فنی پیچیده بدون توضیح

**چه اشتباهی رخ می‌دهد:**
داوطلبان اصطلاحاتی مانند "PagedAttention" یا "GQA" را بدون هیچ توضیحی مطرح می‌کنند.

**چرا اهمیت دارد:**
اگر مصاحبه‌کننده با این اصطلاح آشنا نباشد، به نظر می‌رسد صرفاً قصد خودنمایی با کلمات تخصصی را دارید. اگر هم آشنا باشد، ممکن است سؤالات تکمیلی بپرسد که نتوانید به آن‌ها پاسخ دهید.

**رویکرد بهتر:**
ارائه یک توضیح کوتاه هنگام معرفی اصطلاحات:
```
"I would use vLLM which implements PagedAttention. 
This manages the KV cache like virtual memory, reducing 
fragmentation and enabling higher throughput."
```

---

### خطای ۱۴: تعصب روی پاسخ‌های غلط

**چه اشتباهی رخ می‌دهد:**
هنگامی که مصاحبه‌کننده اشاره می‌کند که یک رویکرد نادرست است، داوطلب به جای بازنگری، بر نظر خود پافشاری می‌کند.

**چرا اهمیت دارد:**
لجبازی یک پرچم قرمز است. پذیرش بازخورد و انعطاف‌پذیری ذهنی بسیار ارزشمند است.

**رویکرد بهتر:**
```
Interviewer: "What about the case where..."
You: "That is a good point. I had not considered [X]. 
Let me revise my approach..."
```

---

## خطاهای استراتژی مصاحبه (Interview Strategy Pitfalls)

### خطای ۱۵: حل کردن مسئله‌ای دیگر

**چه اشتباهی رخ می‌دهد:**
داوطلب نسبت به یک فناوری خاص هیجان‌زده می‌شود و به جای نیازمندی‌های مطرح‌شده، سیستم را بر اساس فناوری مورد علاقه خود طراحی می‌کند.

**مثال:**
از داوطلب خواسته می‌شود یک سیستم ساده پرسش و پاسخ طراحی کند، اما او یک سیستم پیچیده Multi-Agent با قابلیت‌های تحقیقاتی خودکار طراحی می‌کند.

**رویکرد بهتر:**
بر اساس نیازمندی‌ها طراحی کنید، سپس قابلیت‌های توسعه را پیشنهاد دهید:
```
"This design meets the core requirements. If we wanted to 
extend it to handle more complex multi-step queries, we 
could add an agent layer, but I would not start there."
```

---

### خطای ۱۶: عدم مدیریت زمان

**چه اشتباهی رخ می‌دهد:**
داوطلبان ۲۰ دقیقه را صرف معماری اولیه می‌کنند و هیچ زمانی برای ارزیابی، قابلیت اطمینان، پایداری یا مقیاس‌پذیری باقی نمی‌ماند.

**رویکرد بهتر:**
زمان را به‌صورت مشخص تقسیم‌بندی کنید:
- شفاف‌سازی نیازمندی‌ها: ۳ تا ۵ دقیقه
- طراحی در سطح بالا: ۵ تا ۷ دقیقه
- تحلیل‌های عمیق: ۱۰ تا ۱۵ دقیقه
- ارزیابی و قابلیت اطمینان: ۵ تا ۷ دقیقه
- سؤالات و جمع‌بندی: ۳ تا ۵ دقیقه

به زمان توجه داشته باشید و برنامه خود را تنظیم کنید.

---

### خطای ۱۷: رسم نکردن دیاگرام

**چه اشتباهی رخ می‌دهد:**
داوطلبان معماری را فقط به‌صورت کلامی و بدون رسم دیاگرام توضیح می‌دهند.

**چرا اهمیت دارد:**
ارتباط بصری بسیار شفاف‌تر است و نشان می‌دهد می‌توانید با ذی‌نفعان پروژه به درستی ارتباط برقرار کنید.

**رویکرد بهتر:**
هم‌زمان با توضیح دادن، جعبه‌ها و فلش‌ها را رسم کنید. نام‌گذاری‌ها را شفاف انجام دهید. در طول مکالمه از دیاگرام به عنوان مرجع استفاده کنید.

---

## خطاهای خاص هوش مصنوعی (AI-Specific Pitfalls)

### خطای ۱۸: نگاه جعبه سیاه به مولفه‌های هوش مصنوعی

**چه اشتباهی رخ می‌دهد:**
داوطلب با «فراخوانی LLM» مانند یک عملیات اتمی و ساده برخورد می‌کند بدون اینکه بداند در درون آن چه اتفاقی می‌افتد.

**انتظار از موقعیت‌های شغلی ارشد (Senior):**
- درک تفاوت فازهای Prefill و Decode
- آگاهی از عوامل موثر بر تاخیر (Latency) نظیر TTFT و TPS
- درک پیامدها و سازوکار KV Cache
- آگاهی از اثرات Batching

---

### خطای ۱۹: نادیده گرفتن ریسک توهم (Hallucination)

**چه اشتباهی رخ می‌دهد:**
داوطلب سیستمی طراحی می‌کند که کورکورانه به خروجی‌های LLM اعتماد دارد.

**چرا اهمیت دارد:**
توهم ذات مدل‌های زبانی بزرگ است. سیستم‌های محیط عملیاتی (production) باید بتوانند آن را مدیریت کنند.

**رویکرد بهتر:**
```
"Hallucination mitigation has multiple layers:

1. Retrieval grounding: Answer from context only
2. Citation enforcement: Every claim cites a source
3. Abstention: Model says 'I don't know' when appropriate
4. Output validation: Check for impossible claims
5. Confidence display: Show users when to verify"
```

---

### خطای ۲۰: نگاه به امنیت به عنوان یک اولویت ثانویه

**چه اشتباهی رخ می‌دهد:**
ملاحظات امنیتی در پایان بحث مطرح می‌شوند، آن هم اگر وقتی باقی مانده باشد.

**چرا اهمیت دارد:**
سیستم‌های هوش مصنوعی سطوح حمله کاملاً جدیدی دارند (مانند تزریق پرامپت یا نشت داده). امنیت باید از ابتدا در دل سیستم طراحی شود.

**رویکرد بهتر:**
امنیت را در تاروپود طراحی بگنجانید:
```
"For the retrieval layer, I use metadata filtering at the 
database level to ensure tenant isolation. The system prompt 
uses instruction hierarchy to resist injection. Output 
passes through a content filter before reaching the user."
```

در مورد Agentها، سطح حمله شامل تمام مواردی است که Agent می‌تواند به آن‌ها دسترسی پیدا کند. در سال ۲۰۲۶، Agentهای تحت ارزیابی در چندین آزمایشگاه به سیستم‌های واقعی بیرونی نفوذ کردند: یک مدل پژوهشی OpenAI در ماه ژوئن از کنترل‌های دسترسی پرتال آماری بیمه درمان دولتی استرالیا عبور کرد، و در اجرای دیگری از OpenAI، یک Agent از طریق پروتکل DNS به بیرون تونل زد. سیستم مانیتورینگ حدود ۱۲ دقیقه پس از اولین پاسخ خارجی هشدار داد، اما این اجرا ۲.۵ ساعت بعد متوقف شد زیرا مکانیزم توقف خودکار با شکست مواجه شده بود. سیاست مسدودسازی خروجی به‌صورت پیش‌فرض (Default-deny egress شامل DNS)، اعتبارسنجی‌های محدود (Scoped credentials)، و یک کلید قطع اضطراری (Kill switch) که قبلاً عملکرد آن را آزمایش کرده‌اید، باید در اولین دیاگرام حضور داشته باشند، نه اینکه به فاز مقاوم‌سازی در آینده موکول شوند.

---

## چک‌لیست‌های ارزیابی شخصی

### پیش از مصاحبه

- [ ] مرور الگوهای معماری RAG
- [ ] آگاهی از قیمت‌گذاری‌های روز مدل‌ها (به‌طور تقریبی)، شامل ضرایب خواندن کش و کانتکست طولانی
- [ ] توانایی توضیح استراتژی‌های Chunking
- [ ] درک تفاوت Embedding و تولید متن (Generation)
- [ ] آشنایی با متریک‌های ارزیابی رایج
- [ ] توانایی بحث پیرامون حداقل یک پایگاه داده برداری (Vector Database)
- [ ] درک چالش‌های سیستم‌های چندمستأجره (Multi-tenancy)
- [ ] توانایی بحث درباره تکنیک‌های مهندسی پرامپت (Prompt Engineering)

### در طول مصاحبه

- [ ] پرسیدن سؤالات شفاف‌کننده نیازمندی‌ها
- [ ] بیان اولویت‌ها و موازنه‌ها (Tradeoffs)
- [ ] رسم دیاگرام معماری
- [ ] اشاره به رویکرد ارزیابی سیستم
- [ ] بحث پیرامون حالت‌های شکست
- [ ] پرداختن به امنیت و ایزوله‌سازی
- [ ] هماهنگی و دریافت بازخورد از مصاحبه‌کننده
- [ ] مدیریت زمان در طول بخش‌های مختلف

### پس از هر بخش

- [ ] آیا دلیل (WHY) انتخاب را توضیح دادم، نه فقط ماهیت (WHAT) آن را؟
- [ ] آیا به موازنه‌ها (Tradeoffs) اشاره کردم؟
- [ ] آیا در صورت لزوم از اعداد و ارقام ملموس استفاده کردم؟
- [ ] آیا از پیچیدگی‌های غیرضروری اجتناب کردم؟

---

*همچنین ببینید: [بانک سؤالات](01-question-bank.md) | [چارچوب‌های پاسخ‌دهی](02-answer-frameworks.md) | [تمرین‌های تخته‌سفید](04-whiteboard-exercises.md)*

</div>
