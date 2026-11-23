<div dir="rtl">

# معماری RAG در مقیاس پروداکشن

معماری RAG در پروداکشن دیگر یک پروژه آخر هفته نیست؛ بلکه یک سیستم توزیع‌شده با پایپ‌لاین‌های بازیابی، لایه‌های کَش، منطق مسیریابی، حلقه‌های خوداصلاحی، جداسازی چندمستأجری (multi-tenant) و کنترل‌های هزینه است که همگی تحت توافق‌نامه‌های سطح خدمات (SLA) سخت‌گیرانه تاخیر (Latency) عمل می‌کنند. هنگامی که RAG در پروداکشن شکست می‌خورد، علت معمولاً در بالادست مدل نهفته است: قطعه متنی مناسب هرگز به شکلی تمیز Chunking نشده، نمایه‌سازی نشده یا بازیابی نشده است، بنابراین تولیدکننده هرگز آن را ندیده است. به همین دلیل است که استقرار (Deployment)های سازمانی موفق، منبع دانش (و نه مدل) را به عنوان سرمایه‌گذاری اصلی در نظر می‌گیرند.

## فهرست مطالب

- [RAG در برابر زمینه طولانی (Long Context)](#rag-vs-long-context)
- [مسیریابی و طبقه‌بندی پرس‌وجو (Query)](#query-routing-and-classification)
- [کَشینگ معنایی (Semantic Caching) برای RAG](#semantic-caching-for-rag)
- [استراتژی‌های چندنمایه‌ای (Multi-Index)](#multi-index-strategies)
- [بهینه‌سازی پایپ‌لاین RAG](#rag-pipeline-optimization)
- [RAG اصلاحی (Corrective RAG): بازیابی خودآزمون](#corrective-rag-self-checking-retrieval)
- [بازیابی تطبیقی (Adaptive Retrieval)](#adaptive-retrieval)
- [الگوهای بهینه‌سازی هزینه](#cost-optimization-patterns)
- [حالت‌های شکست و دیباگ کردن](#failure-modes-and-debugging)
- [مانیتورینگ و هشداردهی (Monitoring and Alerting)](#monitoring-and-alerting)
- [مقیاس‌پذیری به میلیون‌ها سند](#scaling-to-millions-of-documents)
- [جداسازی چندمستأجری (multi-tenant) در RAG](#multi-tenant-rag-isolation)
- [نمونه‌های معماری در دنیای واقعی](#real-world-architecture-examples)
- [دیدگاه مصاحبه طراحی سیستم](#system-design-interview-angle)
- [منابع](#references)

---

## معماری RAG در برابر زمینه طولانی (Long Context)

با پشتیبانی اکثر خانواده‌های مدل پیشرو از پنجره‌های کانتکست ۱ میلیون Token (شامل Claude Opus 5.5 و Sonnet 5.5، مدل‌های GPT-6 Sol و Astra با ۱.۰۵ میلیون Token، مدل Gemini 4 Argon و رده سریع Gemini 3.8 Flash، مدل Muse Spark 1.3 و مدل‌های متن‌باز نظیر Xiaomi MiMo-V2.6 و Llama 4 Maverick)، پرسش دیگر این نیست که «RAG یا زمینه طولانی (Long Context)؟»، بلکه این است که «هر کدام در چه زمانی برنده می‌شوند؟»

### ماتریس تصمیم‌گیری

<div dir="ltr">

```
                    Small Corpus           Large Corpus
                    (<100K tokens)         (>1M tokens)
                 +---------------------+---------------------+
  Static Data    |  Long Context Wins  |  RAG Required       |
  (rarely        |  - Stuff it all in  |  - Can't fit in     |
   changes)      |  - Simpler arch     |    context window   |
                 |  - No index needed  |  - Index + retrieve |
                 +---------------------+---------------------+
  Dynamic Data   |  Hybrid Approach    |  RAG Required       |
  (updates       |  - Cache context    |  - Incremental      |
   frequently)   |  - Invalidate on    |    indexing          |
                 |    change           |  - Real-time updates |
                 +---------------------+---------------------+
  Multi-User     |  RAG Preferred      |  RAG Required       |
  (per-user      |  - Personalized     |  - Tenant isolation  |
   data)         |    retrieval        |  - Access control    |
                 +---------------------+---------------------+
```

</div>

### مقایسه مستقیم

| بعد | RAG | زمینه طولانی (Long Context - ۱ میلیون Token) |
|---|---|---|
| **میانگین هزینه پرس‌وجو (Query)** | حدود ۰.۰۰۱ تا ۰.۰۱۵ دلار (۵ هزار Token کانتکست، از GPT-6 Luna یا Claude Haiku 5.5 تا Claude Sonnet 5.5) | حدود ۰.۱۰ تا ۰.۲۵ دلار ورودی با کَش گرم کلود (Sonnet 5.5 تا Fable 5.1)؛ ۲ تا ۴ دلار بدون کَش |
| **میانگین تاخیر (Latency) (p50)** | حدود ۱ ثانیه | حدود ۳۰ تا ۴۵ ثانیه |
| **دقت روی حقایق خاص** | بالا (بازیابی هدفمند) | در بخش میانی کاهش می‌یابد |
| **ترکیب و نتیجه‌گیری بین‌سندی (Cross-Document)** | ضعیف (کانتکست محدود) | قوی (همه چیز را می‌بیند) |
| **محدودیت اندازه پیکره متنی (Corpus)** | نامحدود | حدود ۱ میلیون Token |
| **تازگی داده‌ها (Freshness)** | در حد چند دقیقه (نمایه‌سازی افزایشی) | نیازمند بارگذاری مجدد کامل؛ هرگونه ویرایش، کَش را پس از آن نامعتبر می‌سازد |
| **هزینه به ازای هر ۱ میلیون پرس‌وجو (Query)** | حدود ۱ تا ۱۵ هزار دلار | بیش از ۲۰۰ هزار دلار با کَش گرم؛ ۲ تا ۴ میلیون دلار بدون کَش |

### مسئله «گم شدن در میانه» (Lost in the Middle)

مدل‌های LLM در سراسر پنجره کانتکست خود به صورت یکنواخت توجه (Attend) نمی‌کنند. اطلاعاتی که در میانه یک کانتکست طولانی قرار می‌گیرند، در مقایسه با اطلاعات ابتدا یا انتهای آن، با افت دقت بیش از ۳۰ درصدی مواجه می‌شوند. RAG با قرار دادنِ صرفاً مرتبط‌ترین Chunkها در یک کانتکست کوتاه و متمرکز، این مشکل را به‌طور کامل دور می‌زند.

### نقطه سر‌به‌سر خواندن از کَش (Cache-Read Break-Even)

ارزان‌تر شدن خواندن از کَش، مرز این معادله را برای پیکره‌های متنی **پایدار** جابه‌جا کرده است. روی یک مدل یکسان، هزینه‌ی ورودی به ازای هر پرس‌وجو برای یک پیکره متنی که در کَش Prompt ارائه‌دهنده گرم نگه داشته شده است، کمتر از RAG خواهد بود هرگاه:

```
corpus_tokens x cache_read_multiplier  <  retrieved_context_tokens
```

| مدل (قیمت‌های رسمی، ۲ نوامبر ۲۰۲۶) | خواندن از کَش (Cache Read) | حجم پیکره متنی با هزینه معادل یک کانتکست RAG با ۵ هزار Token |
|---|---|---|
| Claude Fable 5.1 | 0.025x (۰.۲۵ دلار به ازای هر ۱ میلیون Token) | حدود ۲۰۰ هزار Token |
| Claude Opus 5.5 | 0.05x (۰.۲۰ دلار به ازای هر ۱ میلیون Token) | حدود ۱۰۰ هزار Token |
| Claude Sonnet 5.5 | 0.05x (۰.۱۰ دلار به ازای هر ۱ میلیون Token، از ۷ اکتبر) | حدود ۱۰۰ هزار Token |
| GPT-6.1 Sol | 0.05x (۰.۱۰ دلار به ازای هر ۱ میلیون Token) | حدود ۱۰۰ هزار Token |
| GPT-6.1 Terra | 0.05x (۰.۰۵ دلار به ازای هر ۱ میلیون Token) | حدود ۱۰۰ هزار Token |
| اکثر مدل‌های دیگر Claude و OpenAI، شامل Claude Haiku 5.5 | 0.1x | حدود ۵۰ هزار Token |

آنچه این فرمول در نظر نمی‌گیرد:
- **نوشتن در کَش و TTLها:** کلود برای نوشتن‌های ۵ دقیقه‌ای ضریب 1.25x و برای نوشتن‌های ۱ ساعته ضریب 2x دریافت می‌کند (در Opus 5.5: ۵ دلار و ۸ دلار به ازای هر ۱ میلیون Token)؛ OpenAI در مدل GPT-5.6 و بالاتر، برای کَش ۳۰ دقیقه‌ای خود ضریب 1.25x و برای گزینه ۱۲ ساعته که در ۲۰ اکتبر ۲۰۲۶ اضافه شد ضریب 2.5x دریافت می‌کند. پیکره متنی‌ای که با فاصله‌های زمانی بیشتر از TTL مورد پرس‌وجو قرار گیرد، بارها و بارها هزینه نوشتن در کَش را متحمل می‌شود؛ نوشتن ۱۲ ساعته تنها در صورتی هزینه خود را جبران می‌کند که پیکره متنی در طول ساعت‌هایی که TTL کوتاه‌تر منقضی می‌شد، مجدداً خوانده شود. مدل Gemini 4 Argon اصلاً کَشینگ صریح (Explicit) ندارد و فقط دارای کَشینگ ضمنی (Implicit) است. کَش‌های صریح Gemini در مدل Gemini 3.8 Flash با ضریب 0.1x خوانده می‌شوند، اما هزینه ذخیره‌سازی را نیز به ازای هر ساعت محاسبه می‌کنند (۰.۵۰ دلار به ازای هر ۱ میلیون Token در ساعت تا ۳۱ دسامبر ۲۰۲۶، و ۱.۰۰ دلار از ۱ ژانویه ۲۰۲۷)، بنابراین یک پیکره متنی گرم با ۲۰۰ هزار Token حتی قبل از یک بار خواندن، ساعتی ۰.۱۰ تا ۰.۲۰ دلار هزینه در بر دارد.
- **اضافه‌بهای کانتکست طولانی:** به محض اینکه ورودی از ۲۷۲ هزار Token فراتر رود، OpenAI کل درخواست را با نرخ‌های کانتکست طولانی محاسبه می‌کند و xAI در ۲۰۰ هزار Token و بالاتر، هزینه تمام Tokenها را دو برابر می‌کند. در مقابل، Anthropic در Claude 4.6 و نسخه‌های بعدی قیمت یکسانی تا ۱ میلیون Token دارد، به جز Claude Haiku 5.5 که به محض عبور Prompt از ۱۰۰ هزار Token (با احتساب خواندن‌ها و نوشتن‌های کَش)، کل درخواست را با ضریب 5x محاسبه می‌کند. بنابراین یک پیکره متنی کَش‌شده با بیش از ۱۰۰ هزار Token در Haiku 5.5 در هر پرس‌وجو در سطح قیمتی بالاتر محاسبه می‌شود که می‌تواند نقطه سر‌به‌سر را مجدداً به نفع بازیابی تغییر دهد.
- **کیفیت و تاخیر (Latency):** خواندن ارزان از کَش، مسئله «گم شدن در میانه» یا زمان Prefill یک Prompt بسیار طولانی را برطرف نمی‌کند، و تنها در صورتی مؤثر است که کل پیکره متنی در کانتکست جا شود.

به جای استناد به آستانه‌های ثابت، این مقدار را به ازای هر مدل مجدداً محاسبه کنید. تغییر عملی در مقیاس‌های کوچک رخ داده است: یک کتابچه راهنما یا مجموعه خط‌مشی‌ها با ۱۰۰ تا ۲۰۰ هزار Token که به ندرت تغییر می‌کند، اکنون اغلب به صورت یک پیشوند کَش‌شده (Cached Prefix) ارزان‌تر و ساده‌تر از یک نمایه تمام می‌شود.

### بهترین شیوه (Best Practice): الگوی ترکیبی (Hybrid)

معماری برنده هر دو را با هم ترکیب می‌کند: استفاده از RAG برای بازیابی برترین کاندیداها از یک پیکره متنی بزرگ، و سپس بارگذاری آن کاندیداها در یک پنجره کانتکست طولانی جهت استدلال و نتیجه‌گیری بین‌سندی (Cross-Document).

<div dir="ltr">

```
  User Query
      |
      v
+------------------+     +-------------------+
|  RAG Retrieval   |---->|  Long Context     |
|  (Find top 20    |     |  Synthesis        |
|   from 10M docs) |     |  (Reason across   |
+------------------+     |   20 docs deeply) |
                          +-------------------+
                                  |
                                  v
                          Final Answer with
                          Cross-Doc Citations
```

</div>

**قاعده سرانگشتی**: اگر پیکره متنی شما در کانتکست جا می‌شود **و** می‌توانید از پس تاخیر (Latency) آن برآیید **و** توان پرداخت هزینه آن را دارید، از زمینه طولانی (Long Context) استفاده کنید. در غیر این صورت، از RAG بهره ببرید. برای اکثر سیستم‌های پروداکشن با محدودیت‌های هزینه و تاخیر (Latency)، RAG همچنان انتخاب پیش‌فرض و صحیح است.

### گزینه سوم: یک‌بار کامپایل کردن دانش (Compile Once)

دسته جدیدتری از محصولات، به جای بازیابی Chunkها به ازای هر پرس‌وجو، دانش ساختاریافته را در زمان ورود داده (Ingestion) از پیش محاسبه می‌کنند. بارزترین نمونه، **Pinecone Nexus** (انتشار عمومی یا GA در ۶ اوت ۲۰۲۶) است: یک کارشناس خبره حوزه (SME)، کار را در قالب یک Manifest توصیف می‌کند (موجودیت‌ها، روابط و ساختار پاسخ‌ها)؛ سپس Nexus اسناد منبع را یک‌بار در قالب خلاصه‌ها، گزیده‌های ساختاریافته و گراف‌های موجودیت-رابطه کامپایل می‌کند و Agentها در قالب یک فراخوانی از طریق زبان KnowQL از آن‌ها پرس‌وجو می‌کنند. لایه داده (Data Plane) در حساب AWS، گوگل کلاد یا Azure مشتری اجرا می‌شود. طبق گزارش Pinecone (بر اساس تست‌های خود ارائه‌دهنده)، در بنچمارک tau-Knowledge، مدل GPT-5.5 همراه با Nexus به امتیاز ۴۷.۴٪ در برابر ۴۶.۴٪ بدون آن دست یافت، در حالی که هزینه به ازای هر تسک ۷۷٪ کمتر بود و فراخوانی‌های مدل حدود ۳۵٪ کاهش یافت.

| | بازیابی در زمان پرس‌وجو (RAG) | یک‌بار کامپایل کردن |
|---|---|---|
| **محل تحمیل هزینه** | در هر پرس‌وجو (Query) | در مرحله ورود داده (Ingestion) و کامپایل مجدد |
| **محل بروز خطاها** | خطاهای عدم بازیابی (Retrieval Misses)، قابل مشاهده در هر پرس‌وجو | خطاهای کامپایل، که تا زمان کامپایل مجدد در تار و پود همه پاسخ‌ها ریشه می‌دواند |
| **پشتیبانی از سوالات پیش‌بینی‌نشده** | بله | فقط در چارچوب ساختارهایی که Manifest پیش‌بینی کرده بود |
| **تغییر تدریجی داده‌ها (Corpus Drift)** | نمایه‌سازی مجدد افزایشی | کامپایل مجدد Artifactهای تحت تأثیر |

الگوی یک‌بار کامپایل کردن مناسب دامنه‌های پایدار و پرحجم با ساختار سوالات تکرارشونده است (نظیر خط‌مشی‌ها، آرای قضایی و کاتالوگ محصولات). بازیابی در زمان پرس‌وجو را برای سوالات پراکنده و اکتشافی حفظ کنید، و حتی در جاهایی که عمل کامپایل را انجام می‌دهید، آن را به عنوان سازوکار پشتیبان (Fallback) نگه دارید.

---

## مسیریابی و طبقه‌بندی پرس‌وجو (Query)

هر پرس‌وجویی به بازیابی نیاز ندارد. یک سیستم پروداکشن پرس‌وجوهای ورودی را طبقه‌بندی کرده و آن‌ها را به بهینه‌ترین مسیر پردازش هدایت می‌کند.

### مسیریاب چهارمسیره (The Four-Path Router)

<div dir="ltr">

```
                         User Query
                             |
                             v
                    +------------------+
                    |  Query Classifier |
                    |  (LLM or trained  |
                    |   classifier)     |
                    +--------+---------+
                             |
            +--------+-------+-------+--------+
            |        |               |        |
            v        v               v        v
        +------+ +--------+    +--------+ +--------+
        |Direct| |Simple  |    |Complex | |Agentic |
        | LLM  | |  RAG   |    |  RAG   | |  RAG   |
        +------+ +--------+    +--------+ +--------+
        "What    "What is      "Compare   "Analyze
        is 2+2?" our refund    Q3 vs Q4   all legal
                  policy?"     revenue    risks in
                               trends"    these 50
                                          contracts"
```

</div>

### سیگنال‌های طبقه‌بندی

| سیگنال | مدل LLM مستقیم | معماری RAG ساده | معماری RAG پیچیده | معماری RAG مبتنی بر Agent (Agentic RAG) |
|---|---|---|---|---|
| **نیازمند داده‌های خصوصی** | خیر | بله | بله | بله |
| **پاسخ تک‌مرحله‌ای (Single-hop)** | بله | بله | خیر | خیر |
| **نیازمند چندین منبع** | خیر | خیر | بله | بله |
| **نیازمند زنجیره استدلال** | خیر | خیر | شاید | بله |
| **داده‌های حساس به زمان** | خیر | شاید | شاید | بله |

### پیاده‌سازی: مسیریاب سبک (Lightweight Router)

```python
class QueryRouter:
    """Routes queries to the optimal retrieval strategy."""

    def __init__(self, classifier_model: str = "gpt-6-luna"):
        self.classifier = classifier_model
        self.route_counts = Counter()  # for monitoring

    async def classify(self, query: str, user_context: dict) -> str:
        # Step 1: Rule-based fast path
        if self._is_trivial(query):
            return "direct_llm"

        # Step 2: Check if query references private/org data
        if not self._needs_retrieval(query, user_context):
            return "direct_llm"

        # Step 3: LLM-based complexity classification
        complexity = await self._assess_complexity(query)

        if complexity == "simple":
            return "simple_rag"
        elif complexity == "multi_hop":
            return "complex_rag"
        else:
            return "agentic_rag"

    def _is_trivial(self, query: str) -> bool:
        """Fast regex/keyword check for trivial queries."""
        trivial_patterns = [
            r"^(what is|define|explain)\s+\w+$",
            r"^(hi|hello|thanks|bye)",
        ]
        return any(re.match(p, query.lower()) for p in trivial_patterns)

    async def _assess_complexity(self, query: str) -> str:
        """Use a small, fast model to classify complexity."""
        prompt = f"""Classify this query's retrieval complexity:
        - "simple": needs one document lookup
        - "multi_hop": needs 2-3 lookups, comparison, or synthesis
        - "agentic": needs planning, tool use, or iterative search

        Query: {query}
        Classification:"""

        result = await llm_call(self.classifier, prompt, max_tokens=10)
        return result.strip().lower()
```

### مسیریابی مبتنی بر حوزه (Domain-Specific)

برای سیستم‌هایی با چندین حوزه دانشی، پیش از بازیابی، پرس‌وجوها را به نمایه صحیح هدایت کنید.

```python
# Rule-based domain routing
DOMAIN_RULES = {
    "revenue|sales|quota|ARR":     "financial_index",
    "policy|handbook|PTO|benefits": "hr_index",
    "API|endpoint|SDK|integration": "engineering_index",
    "compliance|GDPR|SOC2|audit":   "legal_index",
}

# Embedding-based domain routing (for ambiguous queries)
class DomainRouter:
    def __init__(self):
        self.domain_centroids = {}  # pre-computed per domain

    def route(self, query_embedding: list[float]) -> str:
        similarities = {
            domain: cosine_sim(query_embedding, centroid)
            for domain, centroid in self.domain_centroids.items()
        }
        return max(similarities, key=similarities.get)
```

---

## کَشینگ معنایی (Semantic Caching) برای RAG

کَشینگ معنایی تشخیص می‌دهد که یک پرس‌وجوی جدید چه زمانی اساساً معنایی یکسان با یک پرس‌وجوی قبلی دارد و از نتیجه کَش‌شده مجدداً استفاده می‌کند. سیستم‌های پروداکشن با کَش‌های معنایی بهینه‌سازی‌شده، تا ۶۸٪ کاهش هزینه و بهبود ۶۵ برابری در تاخیر (Latency) را گزارش کرده‌اند.

### معماری کَشینگ سه‌لایه‌ای

<div dir="ltr">

```
  User Query
      |
      v
+---------------------+
| Layer 1: Exact Cache |  Hash(query) -> response
| (Redis/Memcached)    |  TTL: 1 hour
| Hit rate: ~15-25%    |  Latency: <5ms
+----------+----------+
           | miss
           v
+---------------------+
| Layer 2: Semantic    |  Embed(query) -> nearest neighbor
| Cache (Vector DB)    |  Threshold: cosine > 0.95
| Hit rate: ~20-35%    |  Latency: <50ms
+----------+----------+
           | miss
           v
+---------------------+
| Layer 3: Document    |  Cache retrieved chunks
| Cache               |  Skip re-embedding
| (saves embedding $) |  TTL: until doc changes
+----------+----------+
           | miss
           v
    Full RAG Pipeline
```

</div>

### پیاده‌سازی کَش معنایی

```python
class SemanticCache:
    """Cache RAG responses by query semantic similarity."""

    def __init__(self, vector_store, similarity_threshold: float = 0.95):
        self.vector_store = vector_store
        self.threshold = similarity_threshold
        self.response_store = {}  # query_id -> cached response

    async def get(self, query: str) -> Optional[CachedResponse]:
        # Step 1: Exact match (fast path)
        exact_key = hashlib.sha256(query.encode()).hexdigest()
        if exact_key in self.response_store:
            return self.response_store[exact_key]

        # Step 2: Semantic match
        query_embedding = await embed(query)
        results = self.vector_store.search(
            query_embedding, top_k=1
        )

        if results and results[0].score >= self.threshold:
            cached_id = results[0].metadata["response_id"]
            cached = self.response_store.get(cached_id)
            if cached and not cached.is_expired():
                return cached

        return None

    async def put(
        self, query: str, response: str,
        sources: list[str], ttl_seconds: int = 3600
    ):
        query_embedding = await embed(query)
        response_id = str(uuid4())

        # Store the embedding for future similarity lookups
        self.vector_store.upsert(
            id=response_id,
            embedding=query_embedding,
            metadata={"response_id": response_id}
        )

        # Store the actual response
        self.response_store[response_id] = CachedResponse(
            response=response,
            sources=sources,
            created_at=time.time(),
            ttl=ttl_seconds,
        )
```

### استراتژی‌های ابطال کَش (Cache Invalidation)

| استراتژی | محرک (Trigger) | مورد استفاده (Use Case) |
|---|---|---|
| **مبتنی بر TTL** | انقضا در زمان ثابت | پرس‌وجوهای عمومی، اخبار |
| **رویدادمحور (Event-driven)** | وبهوک به‌روزرسانی سند | پایگاه‌های دانش |
| **برچسب‌گذاری‌شده با نسخه (Version-tagged)** | عدم تطابق نسخه سند | محیط‌های حساس به الزامات انطباق (Compliance-critical) |
| **دروازه‌بانی‌شده با اطمینان (Confidence-gated)** | امتیاز بازیابی پایین | دامنه‌های متغیر و ناپایدار |

**قاعده حیاتی**: همواره شناسه (ID) اسناد منبع را در کنار پاسخ کَش کنید. هنگامی که هر سند منبعی به‌روزرسانی می‌شود، تمام ورودی‌های کَش را که به آن ارجاع دارند، باطل سازید.

```python
# Webhook-based cache invalidation
@app.post("/webhook/document-updated")
async def on_document_updated(doc_id: str):
    # Find all cache entries that used this document
    affected = cache_index.find_by_source(doc_id)
    for entry in affected:
        semantic_cache.invalidate(entry.response_id)
    logger.info(f"Invalidated {len(affected)} cache entries for doc {doc_id}")
```

---

## استراتژی‌های چندنمایه‌ای (Multi-Index)

یک نمایه یکپارچه و یکپارچه‌ساز (Monolithic) مقیاس‌پذیر نیست. سیستم‌های پروداکشن نمایه‌های برداری خود را بر اساس حوزه، مستأجر (multi-tenant) یا نوع سند پارتیشن‌بندی می‌کنند تا دقت بازیابی و جداسازی عملیاتی را ارتقا دهند.

### الگوهای پارتیشن‌بندی نمایه

<div dir="ltr">

```
Pattern 1: Per-Domain Indexes
+--------+  +--------+  +--------+  +--------+
|  Legal |  |   HR   |  |Finance |  |  Eng   |
| Index  |  | Index  |  | Index  |  | Index  |
+--------+  +--------+  +--------+  +--------+
    |            |            |           |
    +----------- +-----+------+-----------+
                       |
                 Query Router
                       |
                  User Query


Pattern 2: Per-Tenant Indexes (Silo Model)
+----------+  +----------+  +----------+
| Tenant A |  | Tenant B |  | Tenant C |
|  Index   |  |  Index   |  |  Index   |
| (Acme)   |  | (Globex) |  | (Wayne)  |
+----------+  +----------+  +----------+


Pattern 3: Shared Index with Metadata Filtering (Pool Model)
+-------------------------------------------+
|           Shared Vector Index              |
|  +-------+  +-------+  +-------+          |
|  | doc_1 |  | doc_2 |  | doc_3 |  ...     |
|  | t:A   |  | t:B   |  | t:A   |          |
|  +-------+  +-------+  +-------+          |
|                                            |
|  WHERE tenant_id = "A"  <-- filter         |
+-------------------------------------------+
```

</div>

### چه زمانی از هر الگو استفاده کنیم

| الگو | سطح جداسازی (Isolation) | هزینه | پیچیدگی عملیاتی | مناسب‌ترین برای |
|---|---|---|---|---|
| **به ازای حوزه (Per-Domain)** | متوسط | متوسط | متوسط | ابزارهای داخلی با حوزه‌های دانشی متمایز |
| **سیلوی مجزا به ازای هر مستأجر (multi-tenant) (Per-Tenant Silo)** | قوی‌ترین | بالا | بالا | سرویس‌های SaaS سازمانی، صنایع دارای مقررات سفت‌وسخت |
| **استخر مشترک (Shared Pool)** | ضعیف‌ترین | پایین | پایین | سرویس‌های SaaS برای کسب‌وکارهای کوچک و متوسط (SMB)، محصولات حساس به هزینه |
| **پل ترکیبی (Hybrid Bridge)** | قابل تنظیم | متوسط | بالا | پایگاه مشتریان ترکیبی (سازمانی + کسب‌وکارهای کوچک و متوسط) |

### استراتژی نمایه سلسله‌مراتبی (Hierarchical Index Strategy)

برای پیکره‌های متنی بسیار بزرگ، از یک نمایه دو سطحی استفاده کنید: یک "نمایه خلاصه" درشت‌دانه برای مسیریابی، و "نمایه‌های Chunk" ریزدانه برای دستیابی به دقت بالا.

<div dir="ltr">

```
  Query: "What is the refund policy for enterprise plans?"
      |
      v
+--------------------+
| Summary Index      |  Contains doc-level summaries
| (10K entries)      |  Fast, broad search
+--------+-----------+
         |
         | Top 3 matching docs identified
         v
+--------------------+
| Chunk Index        |  Contains 500-token chunks
| (2M entries)       |  Precise, targeted search
| Filtered to 3 docs |
+--------+-----------+
         |
         v
   Top 5 chunks -> LLM
```

</div>

---

## بهینه‌سازی پایپ‌لاین RAG

یک پایپ‌لاین ترتیبی و ساده RAG در هر مرحله تاخیر (Latency) اضافه می‌کند. پایپ‌لاین‌های پروداکشن از موازی‌سازی، دسته‌بندی (Batching) و پردازش ناهمگام (Async) استفاده می‌کنند تا به توافق‌نامه‌های سطح خدمات (SLA) زیر یک ثانیه دست یابند.

### پایپ‌لاین ترتیبی در برابر بهینه‌شده

<div dir="ltr">

```
SEQUENTIAL (Naive):
Query -> Embed(200ms) -> Search(150ms) -> Rerank(300ms) -> Generate(800ms)
Total: ~1450ms

OPTIMIZED (Parallel + Cached):
Query ----+---> Embed(200ms) ---> Vector Search(150ms) ---+
          |                                                |--> RRF Merge -> Rerank(300ms) -> Generate(800ms)
          +---> BM25 Keyword Search(100ms) ---------------+
          |
          +---> Cache Check(5ms) -- HIT --> Return cached (5ms total)

With cache miss: ~1050ms (embedding + keyword in parallel)
With cache hit:  ~5ms
```

</div>

### بازیابی موازی (Parallel Retrieval)

```python
async def parallel_retrieve(
    query: str,
    query_embedding: list[float],
    indexes: list[str],
) -> list[Chunk]:
    """Run vector search, keyword search, and graph traversal in parallel."""

    tasks = [
        vector_search(query_embedding, index="main", top_k=20),
        bm25_search(query, index="main", top_k=20),
        # Optionally, graph-based retrieval for entity queries
        graph_search(query, max_hops=2, top_k=10),
    ]

    # All retrieval strategies execute concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out failures (graceful degradation)
    valid_results = [r for r in results if not isinstance(r, Exception)]

    # Merge with Reciprocal Rank Fusion
    merged = reciprocal_rank_fusion(valid_results, k=60)

    return merged[:20]  # top 20 after fusion
```

### تعبیه‌سازی دسته‌ای (Batched Embedding)

هنگام پردازش ورود داده (Ingestion) یا چندین پرس‌وجو به صورت هم‌زمان، فراخوانی‌های تعبیه‌سازی (Embedding) را دسته‌بندی (Batch) کنید تا میزان بهره‌وری GPU به حداکثر برسد.

```python
class EmbeddingBatcher:
    """Batch embedding requests to reduce per-call overhead."""

    def __init__(self, model: str, batch_size: int = 64, max_wait_ms: int = 50):
        self.model = model
        self.batch_size = batch_size
        self.max_wait = max_wait_ms / 1000
        self.queue: asyncio.Queue = asyncio.Queue()
        self._running = True

    async def embed(self, text: str) -> list[float]:
        """Submit a single text and wait for its embedding."""
        future = asyncio.Future()
        await self.queue.put((text, future))
        return await future

    async def _batch_loop(self):
        """Background loop that collects and processes batches."""
        while self._running:
            batch = []
            try:
                # Wait for at least one item
                item = await asyncio.wait_for(
                    self.queue.get(), timeout=1.0
                )
                batch.append(item)

                # Collect more items up to batch_size or max_wait
                deadline = time.time() + self.max_wait
                while len(batch) < self.batch_size and time.time() < deadline:
                    try:
                        item = await asyncio.wait_for(
                            self.queue.get(),
                            timeout=max(0, deadline - time.time())
                        )
                        batch.append(item)
                    except asyncio.TimeoutError:
                        break

                # Process the batch
                texts = [t for t, _ in batch]
                embeddings = await embed_batch(self.model, texts)

                for (_, future), emb in zip(batch, embeddings):
                    future.set_result(emb)

            except asyncio.TimeoutError:
                continue
```

### تولید جریانی (Streaming Generation) با بازیابی زودهنگام

پیش از آنکه کاربر تایپ کردن را به پایان برساند (با تشخیص مکث در تایپ) بازیابی را آغاز کنید و Tokenهای تولیدشده را هم‌زمان با تولید، استریم کنید.

```
Timeline:
0ms     User starts typing...
300ms   Pause detected -> trigger retrieval speculatively
500ms   User submits query
        Retrieval already 200ms in -> finishes at 650ms
650ms   Reranking begins
950ms   First generation token streams to user
1800ms  Full response complete

vs. without speculation:
0ms     User submits query
200ms   Embedding
350ms   Retrieval
650ms   Reranking
1500ms  First token
2300ms  Full response complete
```

---

## الگوی Corrective RAG: بازیابی خودآزمون (Self-Checking Retrieval)

الگوی Corrective RAG (CRAG) یک لایه راستی‌آزمایی میان بازیابی و تولید پاسخ اضافه می‌کند. سیستم پیش از تولید پاسخ، ارزیابی می‌کند که آیا اسناد بازیابی‌شده واقعاً به پرس‌وجو پاسخ می‌دهند یا خیر.

### حلقه تصمیم‌گیری CRAG

<div dir="ltr">

```
  User Query
      |
      v
  Retrieve Top-K
      |
      v
+------------------+
| Relevance Grader  |  "Are these docs relevant to the query?"
| (LLM or trained   |
|  classifier)      |
+--------+---------+
         |
    +----+----+--------+
    |         |        |
    v         v        v
 CORRECT   AMBIGUOUS  WRONG
    |         |        |
    v         v        v
 Generate  Supplement  Discard &
 directly  with web    re-retrieve
           search      with reformulated
                       query
```

</div>

شاخه AMBIGUOUS نیازمند یک بک‌اند جستجوی وب است، و درگاه‌ها (Gateways) اکنون چنین سرویسی ارائه می‌دهند. سرویس Web Search API شرکت Cloudflare (نسخه بتا، ۲ اکتبر ۲۰۲۶) درون AI Gateway اجرا می‌شود و بریده‌های وب (Web Snippets) ساختاریافته را از Ceramic.ai، Exa و Linkup با قیمت پایه و رسمی این همکاران و بدون هیچ کارمزد اضافه‌ای بازمی‌گرداند که صورت‌حساب و لاگ آن‌ها مستقیماً از طریق درگاه مدیریت می‌شود. صرف‌نظر از ارائه‌دهنده، با نتایج وب به عنوان ورودی غیرقابل اعتماد برخورد کنید: آن‌ها می‌توانند حامل تزریق Prompt (Prompt Injection) باشند، بنابراین آن‌ها را در یک بلوک متنی (Context Block) مجزا و برچسب‌گذاری‌شده قرار دهید و هرگز اجازه ندهید اولویت بالاتری نسبت به اسناد اختصاصی هر مستاجر (multi-tenant) در Prompt پیدا کنند.

### پیاده‌سازی

```python
class CorrectiveRAG:
    """Self-correcting RAG pipeline with retrieval quality checks."""

    def __init__(self, max_corrections: int = 2):
        self.max_corrections = max_corrections

    async def answer(self, query: str) -> RAGResponse:
        attempts = 0
        current_query = query
        all_sources = []

        while attempts <= self.max_corrections:
            # Step 1: Retrieve
            chunks = await retrieve(current_query, top_k=10)

            # Step 2: Grade relevance
            grade = await self._grade_relevance(query, chunks)

            if grade.verdict == "correct":
                # High-confidence retrieval, generate directly
                return await self._generate(query, chunks, all_sources)

            elif grade.verdict == "ambiguous":
                # Supplement with additional search
                web_results = await web_search(current_query)
                chunks = self._merge_and_dedupe(chunks, web_results)
                return await self._generate(query, chunks, all_sources)

            else:  # "wrong"
                # Reformulate query and retry
                current_query = await self._reformulate(
                    original_query=query,
                    failed_query=current_query,
                    reason=grade.reason,
                )
                all_sources.extend(chunks)
                attempts += 1

        # Exhausted retries: generate best-effort with disclaimer
        return await self._generate_with_caveat(query, all_sources)

    async def _grade_relevance(
        self, query: str, chunks: list[Chunk]
    ) -> RelevanceGrade:
        """Use LLM to grade whether chunks answer the query."""
        prompt = f"""Given this query and retrieved documents, assess relevance.

Query: {query}

Documents:
{self._format_chunks(chunks)}

Respond with:
- verdict: "correct" (docs clearly answer the query)
- verdict: "ambiguous" (docs partially relevant, need supplementing)
- verdict: "wrong" (docs are irrelevant to the query)
- reason: brief explanation

JSON response:"""

        result = await llm_call(prompt, response_format="json")
        return RelevanceGrade(**json.loads(result))
```

### الگوی Self-RAG: استفاده از Tokenهای نقاد (Critic Tokens)

الگوی Self-RAG این ساختار را با Tokenهای نقاد درون‌خطی (Inline Critic Tokens) گسترش می‌دهد. مدل در هر مرحله خروجی خود را ارزیابی می‌کند:

۱. **[Retrieve]**: آیا باید بازیابی انجام دهم؟ (بله/خیر)
۲. **[Relevant]**: آیا اطلاعات بازیابی‌شده مرتبط هستند؟ (بله/خیر)
۳. **[Supported]**: آیا پاسخ من با شواهد پشتیبانی می‌شود؟ (کامل/جزئی/خیر)
۴. **[Useful]**: آیا این پاسخ واقعاً مفید است؟ (امتیاز ۱ تا ۵)

اگر هر یک از بررسی‌های نقادانه با شکست مواجه شود، مدل در یک حلقه به مرحله قبل بازمی‌گردد.

---

## بازیابی تطبیقی (Adaptive Retrieval)

همه پرس‌وجوها لزوماً از بازیابی سود نمی‌برند. بازیابی تطبیقی به صورت پویا تصمیم می‌گیرد که آیا بازیابی انجام شود، چه مقدار اطلاعات بازیابی شود و از کدام منابع واکشی گردد.

### درخت تصمیم‌گیری بازیابی

<div dir="ltr">

```
  User Query
      |
      v
  "Does this query need external knowledge?"
      |
  +---+---+
  |       |
  No      Yes
  |       |
  v       v
Direct   "How complex is the retrieval need?"
 LLM      |
answer  +-+--+---------+
        |    |         |
        v    v         v
     Single Multi    Agentic
      hop   hop      (planning
        |    |       required)
        v    v         |
     1 index 2-3       v
     top-5  indexes  Full agent
             top-10  loop
```

</div>

### تخمین‌گر پیچیدگی پرس‌وجو (Query Complexity Estimator)

```python
class AdaptiveRetriever:
    """Decides retrieval strategy based on query characteristics."""

    async def retrieve(self, query: str) -> RetrievalPlan:
        # Fast heuristics first
        if self._is_general_knowledge(query):
            return RetrievalPlan(strategy="none", reason="general knowledge")

        if self._is_simple_lookup(query):
            return RetrievalPlan(
                strategy="single_hop",
                indexes=["primary"],
                top_k=5,
            )

        # LLM-based assessment for ambiguous cases
        plan = await self._plan_retrieval(query)
        return plan

    def _is_general_knowledge(self, query: str) -> bool:
        """Check if query is about widely known facts."""
        general_indicators = [
            "what is", "who is", "define", "explain the concept",
        ]
        has_org_refs = bool(re.search(
            r"(our|my|the company|internal|proprietary)", query.lower()
        ))
        is_general = any(
            query.lower().startswith(g) for g in general_indicators
        )
        return is_general and not has_org_refs

    def _is_simple_lookup(self, query: str) -> bool:
        """Check if query can be answered with a single document."""
        single_hop_patterns = [
            r"what is (the|our) .+ policy",
            r"how (do I|to) .+",
            r"where (can I|do I) find",
        ]
        return any(re.search(p, query.lower()) for p in single_hop_patterns)
```

### بازیابی آگاه از بودجه Token (Token-Budget Aware Retrieval)

میزان تلاش بازیابی را بر اساس بودجه Token موجود و پیچیدگی مورد انتظار برای پاسخ تنظیم کنید (مقیاس‌بندی کنید).

```python
def plan_retrieval_budget(query: str, max_budget_tokens: int = 4000):
    """Allocate token budget across retrieval and generation."""

    complexity = estimate_complexity(query)  # 1-5 scale

    if complexity <= 2:
        # Simple query: small context, save tokens for generation
        return {"context_tokens": 1000, "generation_tokens": 3000, "top_k": 3}
    elif complexity <= 4:
        # Medium: balanced
        return {"context_tokens": 2500, "generation_tokens": 1500, "top_k": 8}
    else:
        # Complex: heavy retrieval, concise generation
        return {"context_tokens": 3500, "generation_tokens": 500, "top_k": 15}
```

### تلاش تطبیقی به عنوان یک قابلیت مدیریت‌شده (Managed Feature)

سرویس‌های جستجوی مدیریت‌شده اکنون این الگوی ارتقا و تشدید (Escalation) را در قالب پیکربندی ارائه می‌دهند. پایگاه‌های دانش Azure AI Search در نسخه REST API 2026-04-01 به صورت عمومی در دسترس (GA) قرار گرفتند (بازیابی استخراجی؛ برنامه‌ریزی پرس‌وجو و ترکیب پاسخ همچنان در حالت پیش‌نمایش هستند)، و در API پیش‌نمایش 2026-08-01 قابلیت تلاش `auto` (`"retrievalReasoningEffort": {"kind": "auto"}` اضافه شده است که به یک مدل روی پایگاه دانش نیاز دارد و در نسخه‌های قبلی API خطای 400 برمی‌گرداند): ابتدا یک دور بازیابی سبک اجرا می‌شود و ارتقا به برنامه‌ریزی پرس‌وجو توسط LLM (تا سطح تلاش متوسط) تنها زمانی صورت می‌گیرد که اتصال به زمینه (Grounding) ناکافی باشد. همین نسخه پیش‌نمایش، نتایج بازیابی را از طریق Server-Sent Events استریم می‌کند و امکان دور زدن رتبه‌بندی مجدد (Reranking) را به ازای هر منبع دانش فراهم می‌سازد. اگر مسیریاب (Router) را خودتان پیاده‌سازی می‌کنید، از همین ساختار الگوبرداری کنید: مسیر کم‌هزینه باید حالت پیش‌فرض باشد، و محرک ارتقای مسیر باید یک سیگنال سنجیده‌شده از Grounding باشد، نه حدس و گمانی درباره پیچیدگی پرس‌وجو.

---

## الگوهای بهینه‌سازی هزینه

در مقیاس بالا، هزینه‌های RAG در مراحل مختلف از جمله Embedding، بازیابی، رتبه‌بندی مجدد (Reranking) و تولید پاسخ با یکدیگر ترکیب و انباشته می‌شوند. سیستم‌های غیربهینه می‌توانند ۱۰ تا ۵۰ برابر بیشتر از حد نیاز هزینه مصرف کنند.

### تفکیک هزینه‌های یک پرس‌وجوی معمول در RAG

```
Component         Cost per Query    % of Total    Optimization
-----------------------------------------------------------------
Embedding         $0.000005         ~1%           Batch + cache
Vector Search     $0.00001          ~2%           Index optimization
Reranking         $0.0001           ~5-15%        Skip for simple queries
LLM Generation    $0.0004-0.008     ~80-95%       Model tiering, caching
-----------------------------------------------------------------
Total (naive)     ~$0.001-0.01
Total (optimized) ~$0.0002-0.002    (5-10x reduction)
```

### استراتژی مدل‌های لایه‌بندی‌شده (Tiered Model Strategy)

<div dir="ltr">

```
                Query Complexity
                Low         Medium        High
             +----------+----------+----------+
 Generation  |  Small   |  Mid     |  Large   |
 Model       |  Model   |  Model   |  Model   |
             | (GPT-6   | (Sonnet  | (Opus    |
             |  Luna)   |  5.5)    |  5.5)    |
             | ~$0.0004 | ~$0.008  | ~$0.016  |
             +----------+----------+----------+

 Reranking   |  Skip    | Lightweight| Cross-  |
             |          | reranker   | encoder |
             +----------+----------+----------+
```

</div>

هزینه‌ها به ازای هر درخواست با ۲.۶ هزار Token ورودی و ۳۰۰ Token خروجی، بر اساس قیمت‌های رسمی ۲ نوامبر ۲۰۲۶ (بدون تغییر از ۱ اکتبر) و پیش از احتساب Tokenهای استدلال (Reasoning Tokens) محاسبه شده‌اند. به تفاوت و گستردگی قیمت‌ها توجه کنید: Claude Opus 5.5 (\$4 / \$20) تنها ۲ برابر Sonnet 5.5 (\$2 / \$10) قیمت دارد، در حالی که Sonnet 5.5 یا GPT-6 Sol بیست (۲۰) برابر GPT-6 Luna هستند. بخش عمده ارزش و صرفه‌جویی حاصل از مسیریابی اکنون در مرز میان مدل‌های کوچک و متوسط (Small/Mid) قرار دارد، بنابراین تلاش و دقت طبقه‌بند (Classifier) را روی این بخش متمرکز کنید؛ چرا که مرز میان مدل‌های متوسط و بزرگ (Mid/Large) به سختی هزینه‌های ناشی از مسیریابی‌های اشتباه خود را جبران می‌کند.

### الگوی جزئیات تدریجی (Progressive Detail Pattern)

در ابتدا با حداقل میزان بازیابی پاسخ دهید. ارتقای سطح بازیابی را فقط در صورتی انجام دهید که کاربر سوالات تکمیلی بپرسد یا سطح اطمینان پایین باشد.

```python
class ProgressiveRAG:
    """Start cheap, escalate only when needed."""

    async def answer(self, query: str, session: Session) -> str:
        # Level 1: Try semantic cache
        cached = await self.cache.get(query)
        if cached:
            return cached.response  # Cost: ~$0

        # Level 2: Fast retrieval + small model
        chunks = await retrieve(query, top_k=3)
        response = await generate(
            query, chunks, model="gpt-6-luna"
        )

        # Check confidence
        if response.confidence > 0.85:
            await self.cache.put(query, response)
            return response.text  # Cost: ~$0.0003

        # Level 3: Deep retrieval + reranking + larger model
        chunks = await retrieve(query, top_k=15)
        reranked = await rerank(query, chunks, top_k=5)
        response = await generate(
            query, reranked, model="claude-sonnet-5-5"  # replaces claude-sonnet-4-5 (retires Nov 30, 2026)
        )

        if response.confidence > 0.7:
            await self.cache.put(query, response)
            return response.text  # Cost: ~$0.008

        # Level 4: Full agentic pipeline (expensive but thorough)
        return await self.agentic_pipeline.run(query)  # Cost: ~$0.05
```

### گاردریل‌های هزینه (Cost Guardrails)

```python
class CostGuard:
    """Prevent runaway costs in production RAG."""

    def __init__(self):
        self.daily_budget = 500.0  # $500/day
        self.per_query_limit = 0.10  # $0.10 max per query
        self.per_user_hourly = 1.0  # $1/user/hour

    async def check(self, user_id: str, estimated_cost: float) -> bool:
        daily_spent = await self.get_daily_spend()
        if daily_spent + estimated_cost > self.daily_budget:
            raise BudgetExceededError("Daily budget exhausted")

        user_spent = await self.get_user_hourly_spend(user_id)
        if user_spent + estimated_cost > self.per_user_hourly:
            raise RateLimitError("User hourly budget exceeded")

        if estimated_cost > self.per_query_limit:
            # Downgrade to cheaper strategy
            return False  # signals caller to use cheaper path

        return True
```

### ساختن در برابر خریدن (Build vs Buy): قیمت‌های واحد در RAG مدیریت‌شده

سرویس‌های مدیریت‌شده بازیابی اکنون قیمت‌گذاری به ازای هر پرس‌وجو را منتشر می‌کنند که این امر تصمیم‌گیری میان ساخت یا خرید (Build vs Buy) را به یک محاسبه ریاضی ساده تبدیل می‌کند. سرویس Cloudflare AI Search در ۱ اکتبر ۲۰۲۶ به عرضه عمومی (GA) رسید: با زیرساخت Workers AI، Vectorize، R2 و Browser Run در پشت صحنه، جستجوی برداری و کلیدواژه‌ای به صورت موازی همراه با ادغام (Fusion) و رتبه‌بندی مجدد (Reranking) اختیاری، OCR اختیاری برای PDFهای اسکن‌شده، و بازیابی تصویر از طریق Qwen3-VL-Embedding. در ۲ نوامبر ۲۰۲۶، شرکت Cloudflare آغاز صدور صورت‌حساب را از ۱ نوامبر به ۱ دسامبر ۲۰۲۶ به تعویق انداخت (قیمت‌ها و حجم مصرف رایگان بدون تغییر ماندند، و هیچ هزینه‌ای برای استفاده‌های پیشین دریافت نمی‌شود) و بازه پیش‌فرض همگام‌سازی را از ۶ ساعت به ۲۴ ساعت تغییر داد. اگر توافق سطح خدمات (SLO) مربوط به تازگی داده‌های شما کمتر از یک روز است، این بازه زمانی را به صورت صریح (هر مقداری از ۱۵ دقیقه تا ۲۴ ساعت) تنظیم کنید؛ در غیر این صورت اسناد جدید ممکن است تا زمان همگام‌سازی بعدی غیرقابل جستجو باقی بمانند. معیارهای سنجش هزینه:

| آیتم | قیمت | سهمیه رایگان ماهانه (در تمام پلن‌های Workers) |
|------|-------|-------------------------------------|
| ورود و پردازش داده (Ingestion) | \$0.75 به ازای هر ۱ میلیون Token، به علاوه \$0.50 به ازای هر ۱ میلیون برای پردازش تصویر | ۵ میلیون Token |
| ذخیره‌سازی (Storage) | \$2.00 به ازای هر گیگابایت-ماه | ۱۰ گیگابایت |
| پرس‌وجوهای معنایی (برداری یا ترکیبی) | \$0.75 به ازای هر ۱ هزار | ۱,۰۰۰ |
| پرس‌وجوهای تمام‌متن (Full-text) | \$0.10 به ازای هر ۱ هزار | ۱,۰۰۰ |

با ۱ میلیون پرس‌وجوی ترکیبی در ماه، هزینه بازیابی \$750 خواهد بود: بسیار کمتر از هزینه زمان مهندسی لازم برای راه‌اندازی و نگهداری استک اختصاصی خودتان. در نرخ ۱,۰۰۰ QPS (حدود ۲.۶ میلیارد پرس‌وجو در ماه) این هزینه فقط برای بازیابی به حدود \$1.9M در ماه می‌رسد، که این مبلغ می‌تواند هزینه نودهای متعدد پایگاه داده برداری (Vector Database) میزبانی‌شده توسط خودتان (Self-hosted) و شیفت‌های آماده‌باش (On-call) را پوشش دهد. نقطه سربه‌سر (Crossover) در محدوده ده‌ها میلیون پرس‌وجو در ماه قرار دارد؛ این نقطه را با در نظر گرفتن هزینه‌های زیرساخت و نیروی انسانی خود محاسبه کنید. سایر ارائه‌دهندگان نیز پکیج‌های مشابهی از این استک را عرضه می‌کنند: سرویس Cohere Compass Cloud (نسخه بتای خصوصی، ۲۵ سپتامبر ۲۰۲۶) امکانات پارس، Embedding متراکم و پراکنده (Dense + Sparse)، بازیابی آگاه از سطوح دسترسی، و رتبه‌بندی مجدد را در قالب یک سرور MCP بسته‌بندی کرده است که Agentها برای محدود کردن گام‌به‌گام پیکره متنی از آن استفاده می‌کنند.

**ریسک چرخه عمر محصول (Lifecycle Risk)، نیمه دیگر تصمیم "خریدن" است.** شرکت OpenAI در ۲۶ اوت ۲۰۲۶ به کار Assistants API پایان داد. ذخیره‌سازهای برداری (Vector Stores) پابرجا ماندند: ابزار `file_search` در Responses API همان شناسه `vector_store_ids` را به همراه `max_num_results` و فیلترهای فراداده (Metadata) می‌پذیرد، بنابراین ایندکس‌ها نیازی به ورود مجدد اطلاعات (Re-ingestion) نداشتند، اما کدهای ارکستراسیون Thread و Run باید بازنویسی می‌شدند. لایه ذخیره‌سازی بازیابی و ارکستراسیون را تفکیک‌پذیر نگه دارید تا هر یک بتواند بدون نیاز به دیگری تغییر کند یا منتقل شود.

---

## حالت‌های شکست و اشکال‌زدایی (Failure Modes and Debugging)

سیستم‌های RAG در محیط عملیاتی (Production) با احتمال شکست فزاینده و ترکیبی مواجه هستند. با قابلیت اطمینان ۹۵٪ در هر یک از سه مرحله، قابلیت اطمینان کلی به 0.95 × 0.95 × 0.95 = 0.86 افت می‌کند. درک حالت‌های شکست امری حیاتی است.

### طبقه‌بندی حالت‌های شکست در RAG (Taxonomy)

<div dir="ltr">

```
+------------------------------------------------------------------+
|                    RAG Failure Modes                               |
+------------------------------------------------------------------+
|                                                                    |
|  RETRIEVAL FAILURES          GENERATION FAILURES                   |
|  +---------------------+    +-------------------------+           |
|  | Missing documents   |    | Hallucination despite   |           |
|  | (not indexed)       |    | good context            |           |
|  +---------------------+    +-------------------------+           |
|  | Wrong chunks        |    | Ignoring retrieved      |           |
|  | (low precision)     |    | context                 |           |
|  +---------------------+    +-------------------------+           |
|  | Missed chunks       |    | Over-reliance on one    |           |
|  | (low recall)        |    | source                  |           |
|  +---------------------+    +-------------------------+           |
|  | Stale embeddings    |    | Citation fabrication    |           |
|  | (drift)             |    |                         |           |
|  +---------------------+    +-------------------------+           |
|                                                                    |
|  SYSTEM FAILURES             QUALITY FAILURES                      |
|  +---------------------+    +-------------------------+           |
|  | Index unavailable   |    | Chunking artifacts      |           |
|  +---------------------+    +-------------------------+           |
|  | Embedding service   |    | Context window overflow |           |
|  | timeout             |    +-------------------------+           |
|  +---------------------+    | Answer too vague        |           |
|  | Reranker OOM        |    | (over-hedging)          |           |
|  +---------------------+    +-------------------------+           |
|                                                                    |
+------------------------------------------------------------------+
```

</div>

### بسیاری از شکست‌های بازیابی ناشی از شکست‌های Chunking هستند

موتور بازیابی تنها می‌تواند Chunkهایی را بازگرداند که توسط Chunk-ساز (Chunker) ایجاد شده‌اند. واقعیتی که میان دو Chunk تقسیم شده باشد، یا Chunkی که عنوان بخش معنابخش به آن حذف شده باشد، فارغ از میزان کیفیت Embeddingها و بازرتبه‌بند (Reranker)، قابل بازیابی نخواهد بود. بنابراین زمانی که چک‌لیست زیر به بازیابی اشاره می‌کند، پیش از تعویض مدل Embedding، ابتدا Chunkها را بررسی کنید. شکست‌های رایج در Chunking:

- **تکه متن (Chunk) بیش از حد کوچک**: بافتار (Context) از دست می‌رود. "هزینه آن \$200 است": هزینه چه چیزی \$200 است؟
- **تکه متن (Chunk) بیش از حد بزرگ**: ارتباط معنایی رقیق و کم‌اثر می‌شود. یک Chunk با ۲۰۰۰ Token که تنها ۱ جمله آن مرتبط است.
- **تقسیم نامناسب مرزها (Boundary splits)**: یک جدول یا فهرست میان دو Chunk تقسیم شده است.
- **فقدان فراداده (Missing metadata)**: Chunkها فاقد عناوین سربرگ، نام سند یا زمینه بخش هستند.

### چک‌لیست اشکال‌زدایی

```
When RAG quality drops, investigate in this order:

1. RETRIEVAL QUALITY (check first: most common root cause)
   [ ] Log the query and retrieved chunks side by side
   [ ] Compute retrieval precision@K manually for 20 failing queries
   [ ] Check if relevant documents exist in the index at all
   [ ] Compare BM25 vs vector results: if BM25 wins, embeddings are stale

2. CHUNKING QUALITY (check second)
   [ ] Sample 50 random chunks: do they make sense in isolation?
   [ ] Check chunk boundaries for tables, lists, code blocks
   [ ] Verify metadata (title, section, doc_id) is present

3. RERANKING QUALITY (check third)
   [ ] Compare pre-rerank vs post-rerank orderings
   [ ] Check if reranker is pushing relevant results down

4. GENERATION QUALITY (check last)
   [ ] Test with perfect context (manually curated): does LLM still fail?
   [ ] Check for context window overflow (truncated chunks)
   [ ] Verify system prompt is not conflicting with retrieved context
```

### حالت‌های شکست در Agentic RAG

معماری Agentic RAG سه الگوی شکست اضافی به همراه دارد:

۱. **کشمکش در بازیابی (Retrieval Thrash)**: Agent بدون همگرایی روی یک پاسخ، مکرراً عملیات بازیابی را تکرار می‌کند. لاگ‌های ردگیری (Traces)، پرس‌وجوهای تقریباً تکراری و عبارات جستجوی نوسانی را نشان می‌دهند. راه‌حل: محدود کردن بازیابی به ۳ تا ۵ تکرار و پایش یکتا بودن پرس‌وجوها در هر نشست (Session).

۲. **طوفان ابزارها (Tool Storms)**: Agent در یک نوبت به شکلی افراطی ابزارها را فراخوانی می‌کند. راه‌حل: تعیین سقف مجاز برای فراخوانی ابزارها به ازای هر پرس‌وجو و مشخص کردن سقف هزینه.

۳. **تورم بافتار (Context Bloat)**: Agent بیش از حد Chunkهای بازیابی‌شده را انباشته می‌کند که باعث سرریز پنجره بافتار (Context Window) می‌شود. راه‌حل: پیاده‌سازی پنجره لغزان (Sliding Window) که با فراتر رفتن حجم زمینه از آستانه مجاز، قدیمی‌ترین Chunkها را حذف کند.

---

## پایش و هشداردهی (Monitoring and Alerting)

سیستم‌های RAG در محیط عملیاتی به پایشی اختصاصی فراتر از معیارهای استاندارد برنامه‌ها نیاز دارند. ارزیابی ساختاریافته را به عنوان یک ضرورت از روز اول در نظر بگیرید، نه به عنوان الگوی "ابتدا تحویل بده، بعداً ارزیابی کن" که در نسل‌های پیشین RAG رواج داشت؛ برای مشاهده معیارها و لایه‌های قضاوت‌کننده، به [الگوهای ارزیابی RAG](13-rag-evaluation-patterns.md) مراجعه کنید.

### پشته پایش RAG (The RAG Monitoring Stack)

<div dir="ltr">

```
+--------------------------------------------------------------------+
|                    RAG Observability Layers                          |
+--------------------------------------------------------------------+
|                                                                      |
|  L1: INFRASTRUCTURE          L2: PIPELINE                           |
|  +----------------------+   +-----------------------------+         |
|  | Latency (p50/p95/p99)|   | Retrieval precision@K      |         |
|  | Error rates          |   | Retrieval recall@K         |         |
|  | Throughput (QPS)     |   | Reranker effectiveness     |         |
|  | Cache hit rate       |   | Chunk utilization rate     |         |
|  | Index size/growth    |   | Context window fill rate   |         |
|  +----------------------+   +-----------------------------+         |
|                                                                      |
|  L3: QUALITY                 L4: BUSINESS                           |
|  +----------------------+   +-----------------------------+         |
|  | Faithfulness score   |   | User satisfaction (thumbs) |         |
|  | Answer relevancy     |   | Task completion rate       |         |
|  | Hallucination rate   |   | Escalation to human rate   |         |
|  | Citation accuracy    |   | Cost per successful query  |         |
|  +----------------------+   +-----------------------------+         |
|                                                                      |
+--------------------------------------------------------------------+
```

</div>

### معیارها و هشدارهای کلیدی

| معیار | هدف (Target) | آستانه هشدار (Alert Threshold) | اقدام (Action) |
|--------|--------|-----------------|--------|
| **تاخیر (Latency) p95** | <2s | >5s | مقیاس‌دهی زیرساخت بازیابی |
| **نرخ اصابت کش (Cache Hit Rate)** | >40% | <20% | تنظیم آستانه شباهت |
| **دقت بازیابی (Retrieval Precision@5)** | >0.7 | <0.5 | ارزیابی مجدد Chunking |
| **وفاداری به منبع (Faithfulness)** | >0.9 | <0.8 | ممیزی Promptهای تولید پاسخ |
| **نرخ توهم (Hallucination Rate)** | <5% | >10% | سخت‌گیرانه‌تر کردن Prompt اتصال به زمینه (Grounding) |
| **نرخ بازیابی تهی (Empty Retrieval Rate)** | <2% | >5% | بررسی پوشش ایندکس |
| **هزینه به ازای هر پرس‌وجو** | <\$0.005 | >\$0.02 | بازنگری در لایه‌بندی مدل‌ها |

### لاگ‌گیری ردگیری سرتاسری (End-to-End Trace Logging)

هر پرس‌وجو باید یک ردگیری (Trace) تولید کند که تمام مراحل پایپ‌لاین را با یک شناسه درخواست (Request ID) واحد به یکدیگر متصل نماید.

```python
@dataclass
class RAGTrace:
    request_id: str
    timestamp: datetime
    query: str
    route: str                    # "simple_rag", "complex_rag", etc.
    cache_hit: bool
    retrieval_latency_ms: float
    chunks_retrieved: int
    chunks_after_rerank: int
    rerank_latency_ms: float
    generation_model: str
    generation_latency_ms: float
    total_latency_ms: float
    input_tokens: int
    output_tokens: int
    estimated_cost: float
    faithfulness_score: float     # 0-1, computed async
    user_feedback: Optional[str]  # thumbs up/down

    def to_dict(self) -> dict:
        return asdict(self)
```

### نمونه‌برداری خودکار کیفیت

ارزیابی آفلاین را روی نمونه‌ای از پرس‌وجوهای محیط عملیاتی (Production) اجرا کنید تا پیش از آنکه کاربران متوجه شوند، افت و تغییر کیفیت (Quality Drift) را شناسایی نمایید.

```python
async def nightly_quality_check(sample_size: int = 200):
    """Sample production queries and evaluate RAG quality."""
    traces = await get_recent_traces(limit=sample_size)

    scores = []
    for trace in traces:
        # Re-run the query with evaluation
        eval_result = await evaluate_rag_response(
            query=trace.query,
            response=trace.response,
            retrieved_chunks=trace.chunks,
            metrics=["faithfulness", "relevancy", "context_precision"],
        )
        scores.append(eval_result)

    avg_faithfulness = mean([s.faithfulness for s in scores])
    avg_relevancy = mean([s.relevancy for s in scores])

    if avg_faithfulness < 0.85:
        alert("RAG faithfulness degraded", severity="high")
    if avg_relevancy < 0.70:
        alert("RAG relevancy degraded", severity="medium")

    publish_metrics("rag.nightly.faithfulness", avg_faithfulness)
    publish_metrics("rag.nightly.relevancy", avg_relevancy)
```

---

## مقیاس‌پذیری تا میلیون‌ها سند

گذار از هزاران سند به میلیون‌ها سند، چالش‌هایی را در توان عملیاتی (Throughput) نمایه‌سازی، تاخیر (Latency) بازیابی و مدیریت نمایه به همراه دارد.

### ابعاد مقیاس‌پذیری

```
Documents:   1K  -->  100K  -->  1M  -->  100M
             |        |         |         |
Chunks:      10K      1M        10M       1B
             |        |         |         |
Index Size:  50MB     5GB       50GB      5TB
             |        |         |         |
Strategy:    Single   Single    Sharded   Distributed
             Node     Node +    Index     Cluster +
                      Replicas             Tiered
```

### خط لوله ورود داده در مقیاس بزرگ

<div dir="ltr">

```
  Document Sources
  (S3, DBs, APIs, File Shares)
         |
         v
+-------------------+
| Ingestion Queue   |  (Kafka / SQS)
| - Deduplication   |
| - Priority queue  |
+--------+----------+
         |
    +----+----+----+----+
    |    |    |    |    |     Parallel workers
    v    v    v    v    v
  +--+ +--+ +--+ +--+ +--+
  |W1| |W2| |W3| |W4| |W5|  Parse + Chunk + Embed
  +--+ +--+ +--+ +--+ +--+
    |    |    |    |    |
    +----+----+----+----+
         |
         v
+-------------------+
| Vector DB Cluster |
| (Sharded by       |
|  doc_type or      |
|  tenant_id)       |
+-------------------+
```

</div>

### استراتژی‌های شاردینگ (Sharding Strategies)

| استراتژی | نحوه کارکرد | مزایا | معایب |
|----------|-------------|------|------|
| **مبتنی بر هش (Hash-based)** | `shard = hash(doc_id) % N` | توزیع یکنواخت | نیاز به پرس‌وجوهای بین‌شاردی (Cross-shard) |
| **مبتنی بر بازه (Range-based)** | شاردبندی بر اساس بازه زمانی | سرعت بالای پرس‌وجوهای مبتنی بر زمان | اندازه‌های نامتقارن شاردها |
| **مبتنی بر دامنه (Domain-based)** | شاردبندی بر اساس نوع سند | بدون نیاز به پرس‌وجوی بین‌شاردی | دامنه‌های نامتعادل |
| **مبتنی بر مستأجر (Tenant-based in multi-tenant)** | شاردبندی بر اساس `tenant_id` | جداسازی بی‌نقص | تعداد زیادی شارد کوچک |

### نگهداری نمایه (Index Maintenance)

در مقیاس میلیون‌ها سند، نگهداری نمایه به یک دغدغه عملیاتی حیاتی تبدیل می‌شود.

```python
class IndexMaintenanceScheduler:
    """Scheduled tasks for index health at scale."""

    async def run_daily(self):
        # 1. Detect and re-embed stale documents
        stale_docs = await find_docs_with_old_embeddings(
            older_than_days=90,
            embedding_model_version="v2"  # current is v3
        )
        if stale_docs:
            await enqueue_reembedding(stale_docs)

        # 2. Remove orphaned vectors (doc deleted but vector remains)
        orphans = await find_orphaned_vectors()
        if orphans:
            await delete_vectors(orphans)

        # 3. Compact and optimize indexes
        for shard in await list_shards():
            if shard.fragmentation_pct > 20:
                await compact_shard(shard.id)

        # 4. Verify index health
        for shard in await list_shards():
            health = await check_shard_health(shard.id)
            if not health.ok:
                alert(f"Shard {shard.id} unhealthy: {health.reason}")
```

### بازتولید Embedding بدون توقف سرویس (Re-Embedding Without Downtime)

این باور که «مدل Embedding جدید به معنای نمایه‌سازی مجدد کامل است» دیگر تنها پاسخ موجود نیست:

- **فضاهای Embedding مشترک (Shared embedding spaces).** خانواده Voyage 4 (مدل‌های voyage-4-large با قیمت \$0.12، مدل voyage-4 با قیمت \$0.06 و مدل voyage-4-lite با قیمت \$0.02 به ازای هر ۱ میلیون Token، به‌علاوه مدل وزن‌باز voyage-4-nano) همگی از یک فضا به صورت مشترک استفاده می‌کنند؛ همان‌طور که مدل‌های `embed-v5.0-pro` و `-fast` از شرکت Cohere (در ۳۰ سپتامبر ۲۰۲۶) این‌گونه هستند. یک بار با مدل بزرگ نمایه‌سازی کنید و پرس‌وجوها را با مدل کوچک انجام دهید؛ می‌توانید مدل سمت پرس‌وجو را بدون دستکاری نمایه تغییر دهید. پیش‌نمایش تحقیقاتی Constella از شرکت Qdrant (در ۲۹ سپتامبر ۲۰۲۶) این ایده را فراتر می‌برد: یک نمایه سند ثابت Stella (با ۴۰۰ میلیون پارامتر) با رمزگذارهای پرس‌وجو (Query Encoders) قابل تعویض، که در آن مدل ۳۴٫۵ میلیون پارامتری Constella Nano حدود ۹۱٪ از معیار BEIR nDCG@10 مدل Stella را با ۱۲ برابر تاخیر (Latency) کمتر در CPU (طبق گزارش ارائه‌دهنده) حفظ می‌کند.
- **پر کردن مجدد آنلاین (Online backfill).** هنگامی که بخش اسناد باید تغییر کند، یک فیلد برداری دوم اضافه کنید، آن را در پس‌زمینه پر کنید (Backfill)، هر دو را به صورت آزمایشی در سایه (Shadow-query) روی مجموعه طلایی ارزیابی نمایید و سپس عملیات سوئیچ و انتقال نهایی (Cut over) را انجام دهید. نرم‌افزار Milvus 3.0 (ژوئیه ۲۰۲۶) از افزودن، پر کردن و حذف آنلاین ستون‌ها پشتیبانی می‌کند که این قابلیت، آن را به مسیری پرسرعت و بهینه (Hot path) روی صدها میلیون سطر تبدیل کرده است.
- **تولید Embedding درون پایگاه داده (Embedding inside the database).** قابلیت Automated Embedding در MongoDB Atlas (عرضه عمومی در ۱۳ اوت ۲۰۲۶) و Embedding بومی turbopuffer (عرضه عمومی در ۲۹ سپتامبر ۲۰۲۶) خط لوله همگام‌سازی را حذف می‌کنند، اما نمایه را به نسخه مدلی که توسط ارائه‌دهنده انتخاب شده گره می‌زنند. پیش از به‌کارگیری، بررسی کنید که ارتقای مدل‌ها و بازتولید Embedding چگونه زمان‌بندی شده و هزینه آن چگونه محاسبه می‌شود.

### سطوح حافظه و کوانتیزاسیون (Memory Tiers and Quantization)

در ابعاد ۱۵۳۶ با دقت float32، حجم هر بردار ۶ کیلوبایت است، بنابراین یک میلیارد Chunk پیش از ساخت گراف حدود ۶ ترابایت فضا نیاز دارد. کوانتیزاسیون کم‌بیت مبتنی بر چرخش (Rotation-based low-bit quantization) اهرم اصلی است، و قابلیتی است که **باید صریحاً فعال شود یا در حالت پیش‌نمایش قرار دارد، نه پیش‌فرض**: Qdrant قابلیت TurboQuant با چرخش هادامارد (Hadamard-rotated) را در نسخه ۱.۱۸، یک نوع ذخیره‌سازی اختصاصی ۴ بیتی به نام Turbo4 را در نسخه ۱.۱۹ (۹ برابر کوچک‌تر از float32 به همراه یک کپی ۴ بیتی، به قیمت کاهش اوج Recall، چرا که داده‌های اصلی حذف می‌شوند)، و انواع داده `turbo8` و `turbo16` را در ۱.۲۰ اضافه کرد؛ نسخه ۱.۳۹ از Weaviate پیش‌نمایشی از کوانتیزاسیون چرخشی ۴ بیتی (Rotational Quantization، کاهش حجم از ۶,۱۴۴ بایت به ۷۸۴ بایت برای یک بردار ۱۵۳۶ بعدی) را ارائه داد و نسخه ۱.۴۰ گونه متمرکز RQ4 را به آن افزود. همچنین Qdrant 1.19 تنظیمات `on_disk` / `always_ram` را با یک تنظیم واحد تحت عنوان `memory` (شامل حالت‌های پین‌شده/pinned، کَش‌شده/cached یا سرد/cold) در سراسر بردارهای HNSW، نمایه‌های اسپارس (Sparse) و Payload جایگزین کرد.

الگوی محیط عملیاتی: بردارهای کوانتیزه‌شده برای جستجوی کاندیداها در RAM پین می‌شوند، نسخه‌های اصلی با دقت کامل (Full-precision) برای بازامتیازدهی (Rescoring) کاندیداهای برتر به صورت سرد روی دیسک باقی می‌مانند، و میزان Recall الگوریتم ANN پس از هر تغییر کوانتیزاسیون در برابر kNN دقیق سنجیده می‌شود (ببینید: [الگوهای ارزیابی RAG](13-rag-evaluation-patterns.md#separate-the-embedder-from-the-index)).

### رپلیکاهای خواندن برای بازیابی (Read Replicas for Retrieval)

مسیرهای خواندن و نوشتن را تفکیک کنید تا ورود داده هرگز باعث افت تاخیر (Latency) پرس‌وجو نشود.

<div dir="ltr">

```
  Ingestion Pipeline              Query Pipeline
        |                              |
        v                              v
  +-----------+     Replication   +-----------+
  |  Primary  | ----------------> |  Replica  |
  |  (Write)  |                   |  (Read)   |
  +-----------+                   +-----------+
                                  |  Replica  |
                                  |  (Read)   |
                                  +-----------+
                                  |  Replica  |
                                  |  (Read)   |
                                  +-----------+
```

</div>

---

## جداسازی چندمستأجری در RAG (Multi-Tenant RAG Isolation)

سیستم RAG چندمستأجری (Multi-Tenant RAG) متداول‌ترین الگوی محیط عملیاتی برای محصولات SaaS است. پیاده‌سازی نادرست جداسازی به معنای نشت داده‌ها میان مستأجران (tenants in multi-tenant) است که یک رخنه امنیتی حیاتی به شمار می‌رود.

### سه مدل جداسازی (Three Isolation Models)

<div dir="ltr">

```
SILO MODEL (Strongest Isolation)
+----------+  +----------+  +----------+
| Tenant A |  | Tenant B |  | Tenant C |
| +------+ |  | +------+ |  | +------+ |
| |Index | |  | |Index | |  | |Index | |
| +------+ |  | +------+ |  | +------+ |
| |Cache | |  | |Cache | |  | |Cache | |
| +------+ |  | +------+ |  | +------+ |
+----------+  +----------+  +----------+
Cost: $$$$    Best for: Enterprise, Regulated Industries


POOL MODEL (Cost-Efficient)
+-------------------------------------------+
|              Shared Index                  |
|  [A] [B] [A] [C] [B] [A] [C] [B] [C]    |
|                                            |
|  Every query includes:                     |
|  WHERE tenant_id = ? (MANDATORY)           |
+-------------------------------------------+
Cost: $       Best for: SMB SaaS


BRIDGE MODEL (Hybrid)
+----------+  +----------------------------+
| Tenant A |  |     Shared Pool            |
| (Enterprise) | [B] [C] [D] [E] [F] [G]  |
| +------+ |  |                            |
| |Dedicated|  | WHERE tenant_id = ?       |
| |Index | |  +----------------------------+
| +------+ |
+----------+
Cost: $$      Best for: Mixed customer base
```

</div>

### امنیت: دفاع در عمق (Defense in Depth)

```python
class TenantIsolatedRetriever:
    """Enforces tenant isolation at every retrieval layer."""

    async def retrieve(
        self, query: str, tenant_id: str, user_id: str
    ) -> list[Chunk]:
        # Layer 1: Tenant ID is MANDATORY in every query
        if not tenant_id:
            raise SecurityError("tenant_id required for retrieval")

        # Layer 2: Validate user belongs to tenant
        if not await self.authz.user_in_tenant(user_id, tenant_id):
            raise AuthorizationError("User not in tenant")

        # Layer 3: Apply tenant filter at the database level
        chunks = await self.vector_db.search(
            query_embedding=await embed(query),
            filter={"tenant_id": {"$eq": tenant_id}},  # ALWAYS filtered
            top_k=10,
        )

        # Layer 4: Post-retrieval verification
        for chunk in chunks:
            assert chunk.metadata["tenant_id"] == tenant_id, \
                f"Cross-tenant leak detected: {chunk.id}"

        # Layer 5: Audit log
        await self.audit_log.record(
            action="retrieve",
            tenant_id=tenant_id,
            user_id=user_id,
            chunk_ids=[c.id for c in chunks],
        )

        return chunks
```

### رخنه‌هایی که فیلتر مستأجر (Tenant Filter in multi-tenant) مانع آن‌ها نمی‌شود

یک فیلتر اجباری `tenant_id` مانع از نمایش *نتایج* بین‌مستأجری می‌شود؛ اما جلوی *سیگنال‌های* بین‌مستأجری (cross-tenant signals in multi-tenant) را نمی‌گیرد:

| کانال | نحوه نشت | راهکار کاهش مخاطره (Mitigation) |
|-------|---------|---------------------------------|
| **آمار مشترک BM25 (Shared BM25 statistics)** | در یک نمایه اشتراکی (Pooled index)، مقدار IDF روی اسناد تمامی مستأجران (tenants in multi-tenant) محاسبه می‌شود؛ بنابراین دایره واژگان یک مستأجر رتبه‌بندی مستأجر دیگر را تغییر می‌دهد و نمرات، منعکس‌کننده بسامد اصطلاحات در کل پیکره متنی خواهند بود. | محاسبه IDF به ازای هر مستأجر (Per-tenant IDF in multi-tenant - نسخه Qdrant 1.19 این قابلیت را برای جستجوی اسپارس/BM25 اضافه کرد)، یا استفاده از یک نمایه واژگانی تفکیک‌شده (Siloed lexical index). |
| **کَش پیشوند استنتاج (Inference prefix cache)** | در موتورهای خودمیزبان، یک کَش پیشوند مشترک می‌تواند به عنوان یک ابزار سنجش زمان (Timing oracle) آشکار سازد که آیا مستأجر (tenant in multi-tenant) دیگری همان پیشوند را ارسال کرده است یا خیر. | استفاده از Cache salt به ازای هر مستأجر (Per-tenant cache salt in multi-tenant) در تمامی مسیرهای کد. آسیب‌پذیری vLLM GHSA-935w-9g4m-p28p (برطرف‌شده در نسخه 0.30.0) یکی از مسیرهایی بود که این Salt را حذف می‌کرد؛ از vLLM نسخه 0.32.0 یا بالاتر استفاده کنید که حداقل سطح امنیتی فعلی است (همچنین آسیب‌پذیری‌های CVE-2026-115912 و CVE-2026-115915 را برطرف می‌کند). |
| **کَش پاسخ معنایی (Semantic response cache)** | پاسخی که از اسناد مستأجر A ساخته شده است، برای پرس‌وجوی مشابه مستأجر B (در معماری چندمستأجری / multi-tenant) ارائه می‌شود. | کلیدگذاری کَش بر اساس مستأجر (tenant in multi-tenant) و مجموعه ACL، و هرگز به صورت سراسری (Global). |
| **آسیب‌پذیری‌های موتور (Engine vulnerabilities)** | باگ‌هایی که توسط هر نقشی با مجوز ساخت نمایه قابل دسترسی هستند. | نسخه pgvector 0.8.7 (۱ اکتبر ۲۰۲۶) آسیب‌پذیری CVE-2026-103484 را برطرف می‌کند که یک خطای سرریز ساخت IVFFlat بوده و می‌تواند منجر به اجرای کد شود (در نسخه 0.8.6 و پایین‌تر). مجوز ساخت نمایه را به نقش‌های کاربری برنامه ندهید و مطمئن شوید که سرویس مدیریت‌شده Postgres شما این وصله را اعمال کرده است. |

ایزوله‌سازی (Silo) امروزه می‌تواند به معنای حساب کاربری ابری خود مشتری نیز باشد: سرویس Pinecone BYOC (عرضه عمومی در ۲۳ سپتامبر ۲۰۲۶ روی AWS، Google Cloud و Azure) لایه داده (Data plane) شامل بردارها، اسناد، متادیتا و Payloadهای درخواست را در ابر خود مشتری اجرا می‌کند، در حالی که لایه کنترل ارائه‌دهنده فقط از طریق فراخوانی‌های خروجی (Outbound calls) آن را مدیریت می‌نماید.

### ورود داده آگاه به مستأجر (Tenant-Aware Ingestion in multi-tenant)

زمینه و هویت مستأجر (Tenant context in multi-tenant) باید در تمامی مراحل خط لوله، از ورود داده تا مرحله تولید (Generation)، تزریق شود.

<div dir="ltr">

```
Document Upload (Tenant A)
        |
        v
  +---------------------+
  | Validate Ownership  |  Does this doc belong to Tenant A?
  +---------------------+
        |
        v
  +---------------------+
  | Chunk + Embed       |  Attach tenant_id to every chunk
  +---------------------+
        |
        v
  +---------------------+
  | Index with Metadata |  {"tenant_id": "A", "doc_id": "...", ...}
  +---------------------+
        |
        v
  +---------------------+
  | Invalidate Cache    |  Clear Tenant A's cache entries
  +---------------------+             for affected documents
```

</div>

### جلوگیری از همسایه ناهنجار (Noisy Neighbor Prevention in multi-tenant)

در مدل اشتراکی (Pool model)، مصرف سنگین یک مستأجر می‌تواند کارایی را برای تمامی مستأجران (tenants in multi-tenant) دچار افت کند.

```python
class TenantRateLimiter:
    """Per-tenant rate limiting and resource quotas."""

    def __init__(self):
        self.tenant_limits = {
            "free":       {"qps": 5,   "daily_queries": 500},
            "pro":        {"qps": 50,  "daily_queries": 10_000},
            "enterprise": {"qps": 200, "daily_queries": 100_000},
        }

    async def check(self, tenant_id: str, tier: str) -> bool:
        limits = self.tenant_limits[tier]

        current_qps = await self.redis.get(f"qps:{tenant_id}")
        if current_qps and int(current_qps) >= limits["qps"]:
            raise RateLimitError(f"QPS limit ({limits['qps']}) exceeded")

        daily_count = await self.redis.get(f"daily:{tenant_id}")
        if daily_count and int(daily_count) >= limits["daily_queries"]:
            raise RateLimitError("Daily query limit exceeded")

        # Increment counters
        pipe = self.redis.pipeline()
        pipe.incr(f"qps:{tenant_id}")
        pipe.expire(f"qps:{tenant_id}", 1)  # 1-second window
        pipe.incr(f"daily:{tenant_id}")
        pipe.expire(f"daily:{tenant_id}", 86400)
        await pipe.execute()

        return True
```

---

## نمونه‌های معماری در دنیای واقعی

### مثال ۱: سیستم RAG برای پشتیبانی مشتریان

<div dir="ltr">

```
+------------------------------------------------------------------+
|                   Customer Support RAG System                     |
+------------------------------------------------------------------+
|                                                                    |
|  Customer Query                                                    |
|       |                                                            |
|       v                                                            |
|  +------------+    +---------+    +------------------+             |
|  | Query      |--->| Semantic|--->| Intent           |             |
|  | Normalizer |    | Cache   |    | Classifier       |             |
|  +------------+    +---------+    +--------+---------+             |
|                     (hit->skip)            |                       |
|                                   +--------+---------+             |
|                                   |                  |             |
|                                   v                  v             |
|                             +-----------+    +-------------+      |
|                             | Knowledge |    | Order/Acct  |      |
|                             | Base RAG  |    | Database    |      |
|                             | (articles,|    | (SQL lookup)|      |
|                             |  FAQs)    |    +-------------+      |
|                             +-----------+           |              |
|                                   |                 |              |
|                                   +--------+--------+              |
|                                            |                       |
|                                            v                       |
|                                   +------------------+             |
|                                   | Response Gen     |             |
|                                   | (with citations  |             |
|                                   |  + confidence)   |             |
|                                   +--------+---------+             |
|                                            |                       |
|                                   +--------+---------+             |
|                                   |                  |             |
|                                   v                  v             |
|                            confidence > 0.8    confidence < 0.8   |
|                            Auto-respond        Route to human      |
|                                                                    |
+------------------------------------------------------------------+

Scale: 50K articles, 2M customer interactions/month
Latency SLA: p95 < 3s
Cache hit rate: ~45%
Auto-resolution rate: ~60%
```

</div>

### مثال ۲: پلتفرم دانش سازمانی

<div dir="ltr">

```
+------------------------------------------------------------------+
|              Enterprise Multi-Tenant Knowledge Platform            |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------+                                              |
|  | Auth + Tenant    |                                              |
|  | Resolution       |                                              |
|  +--------+---------+                                              |
|           |                                                        |
|           v                                                        |
|  +------------------+                                              |
|  | Query Router     |                                              |
|  +--+----+----+-----+                                              |
|     |    |    |                                                     |
|     v    v    v                                                     |
|  +----+ +----+ +--------+                                          |
|  |Docs| |Wiki| |Tickets |  Per-domain indexes                     |
|  |Idx | |Idx | |Idx     |  (all tenant-filtered)                   |
|  +----+ +----+ +--------+                                          |
|     |    |    |                                                     |
|     +----+----+                                                     |
|          |                                                          |
|          v                                                          |
|  +------------------+                                              |
|  | Cross-Encoder    |                                              |
|  | Reranker         |                                              |
|  +--------+---------+                                              |
|           |                                                        |
|           v                                                        |
|  +------------------+     +-------------------+                    |
|  | Tiered LLM       |<--->| Permission Filter |                    |
|  | Generation        |     | (doc-level ACLs)  |                    |
|  +------------------+     +-------------------+                    |
|           |                                                        |
|           v                                                        |
|  +------------------+                                              |
|  | Response + Audit |                                              |
|  | Trail            |                                              |
|  +------------------+                                              |
|                                                                    |
+------------------------------------------------------------------+

Scale: 200 tenants, 10M documents total, 500K queries/day
Isolation: Bridge model (5 enterprise silos + shared pool)
Ingestion: Async via Kafka, ~50K docs/day
```

</div>

### مثال ۳: تحلیل اسناد حقوقی

<div dir="ltr">

```
  User: "Summarize indemnification clauses across all vendor contracts"
      |
      v
  +---------------------+
  | Agentic RAG Planner |
  +---------------------+
      |
      | Plan: 1. Find all vendor contracts
      |        2. Extract indemnification clauses
      |        3. Synthesize comparison
      |
      v
  +---------------------+    +-------------------+
  | Step 1: Metadata    |--->| Filter: doc_type  |
  | Search              |    | = "vendor_contract"|
  +---------------------+    +-------------------+
      |                            |
      | 47 contracts found         |
      v                            v
  +---------------------+    +-------------------+
  | Step 2: Section     |--->| Filter: section   |
  | Retrieval           |    | = "indemnification"|
  +---------------------+    +-------------------+
      |                            |
      | 43 relevant sections       |
      v                            |
  +---------------------+         |
  | Step 3: Long Context|<--------+
  | Synthesis           |
  | (load 43 sections   |
  |  into 1M context)   |
  +---------------------+
      |
      v
  Comparative summary with
  per-contract citations
```

</div>

---

## زاویه دید مصاحبه طراحی سیستم (System Design)

### پرسش: یک سیستم RAG طراحی کنید که به ۱۰,۰۰۰ پرس‌وجو در ثانیه در میان ۵۰۰ مستأجر (tenants in multi-tenant) با تاخیر (Latency) صدک ۹۹ (p99) برابر با ۲ ثانیه پاسخ دهد.

**پاسخ قوی:**

من این سیستم را در چهار لایه طراحی می‌کنم.

**لایه ۱: مسیریابی و کَش‌گذاری (Routing and Caching).** یک مسیریاب پرس‌وجو (Query router) هر پرس‌وجوی ورودی را طبقه‌بندی می‌کند (ارسال مستقیم به LLM، مدل RAG ساده، مدل RAG پیچیده). یک کَش سه لایه (تطابق دقیق/Exact match، کَش معنایی/Semantic cache، و کَش سند/Document cache) تقریباً ۴۰ تا ۵۰ درصد از ترافیک را پاسخ می‌دهد. این یعنی تنها ۵,۰۰۰ تا ۶,۰۰۰ پرس‌وجو در ثانیه (QPS) به خط لوله بازیابی می‌رسند.

**لایه ۲: بازیابی (Retrieval).** من از مدل جداسازی پل (Bridge isolation model) استفاده می‌کنم: ۲۰ مستأجر سازمانی بزرگ نمایه‌های اختصاصی (Silo) دریافت می‌کنند و ۴۸۰ مستأجر باقی‌مانده یک نمایه مشترک (Pooled) را با فیلتر اجباری `tenant_id` به اشتراک می‌گذارند. بازیابی، جستجوی ترکیبی (Hybrid search: برداری + BM25) را به صورت موازی اجرا می‌کند و از روش Reciprocal Rank Fusion برای ادغام نتایج بهره می‌برد. کلاستر پایگاه داده برداری (Vector Database) بر اساس سطح سازمانی مستأجر (Tenant tier in multi-tenant) شاردبندی شده و برای توان عملیاتی (Throughput) خواندن، رپلیکیت (Replicated) می‌شود.

**لایه ۳: تولید (Generation).** یک استراتژی مدلی چندسطحی (Tiered model strategy) پرس‌وجوهای ساده را به یک مدل کوچک و پرس‌وجوهای پیچیده را به یک مدل بزرگ‌تر هدایت می‌کند. این رویکرد میانگین هزینه‌ها را پایین نگه می‌دارد و در عین حال کیفیت پاسخ به پرس‌وجوهای دشوار را حفظ می‌کند. اعمال محدودیت نرخ به ازای هر مستأجر (Per-tenant rate limiting in multi-tenant) مانع از ایجاد مشکل همسایگان ناهنجار (Noisy Neighbors in multi-tenant) می‌شود.

**لایه ۴: مشاهده‌پذیری (Observability).** هر پرس‌وجو یک ردگیری (Trace) شامل تفکیک تاخیر (Latency)، امتیازات بازیابی و هزینه تولید می‌کند. ارزیابی‌های کیفی شبانه ۵۰۰ پرس‌وجو را به عنوان نمونه بررسی کرده و معیارهای وفاداری (Faithfulness) و ارتباط (Relevancy) را می‌سنجند. در صورتی که تاخیر صدک ۹۵ (p95 latency) از ۳ ثانیه فراتر رود یا وفاداری به زیر ۰٫۸۵ سقوط کند، هشدارها فعال می‌شوند.

**برآورد هزینه**: ۱۰ هزار QPS معادل ۸۶۴ میلیون پرس‌وجو در روز است، بنابراین محاسبات به ازای هر درخواست عامل تعیین‌کننده اصلی است. با ۵۰٪ اصابت به کَش (Cache hits)، روزانه ۴۳۲ میلیون مرحله تولید باقی می‌ماند. به ازای ۲٫۶ هزار Token ورودی و ۳۰۰ Token خروجی در هر درخواست و با قیمت‌های رسمی اکتبر ۲۰۲۶، تقسیم ۷۰/۳۰ میان مدل GPT-6 Luna (حدود \$0.0004 به ازای هر درخواست) و یک مدل میان‌رده با نرخ \$2 / \$10 نظیر Claude Sonnet 5.5 یا GPT-6 Sol (حدود \$0.008)، هزینه‌ای معادل ۱۲۰ هزار دلار به‌علاوه ۱٫۰۶ میلیون دلار، یعنی تقریباً **۱٫۲ میلیون دلار در روز** به همراه دارد، پیش از آن‌که Prompt Caching برای Prompt سیستمی مشترک اعمال شود. این رقم تصمیمات واقعی طراحی را هدایت می‌کند: کَش کردن پیشوند استاتیک Prompt (کاهش هزینه خواندن به میزان ۰٫۱ برابر یا کمتر)، بالا بردن نرخ اصابت به کَش، مذاکره بر سر قیمت‌گذاری استفاده متعهدانه (Committed-use pricing)، و خودمیزبانی لایه مدل‌های کوچک؛ چرا که روزانه حدود ۳۰۰ میلیون درخواست مدل کوچک بسیار فراتر از نقطه‌ای است که در آن داشتن یک ناوگان اختصاصی از GPUها از یک API مبتنی بر Token ارزان‌تر تمام می‌شود.

### پرسش: چگونه شرایطی را مدیریت می‌کنید که سیستم RAG اسناد نامربوط را بازیابی می‌کند اما LLM در هر صورت پاسخی به ظاهر موجه تولید می‌نماید؟

**پاسخ قوی:**

این خطرناک‌ترین حالت شکست در RAG است، زیرا توهماتی (Hallucinations) با لحن مطمئن تولید می‌کند که به اسناد واقعی (اما نامربوط) ارجاع داده شده‌اند. من در سه نقطه با این مشکل مقابله می‌کنم:

نخست، در مرحله بازیابی، یک ارزیاب ارتباط (Relevance grader) پیاده‌سازی کنید؛ یک دسته‌بندی‌کننده (یا فراخوانی LLM) که به هر Chunk بازیابی‌شده در مقایسه با پرس‌وجو امتیاز می‌دهد. اگر امتیاز تمام Chunkها زیر یک آستانه مشخص باشد، سیستم باید یا فرآیند را به جستجوی وب ارجاع دهد (الگوی RAG اصلاحی یا Corrective RAG) یا به جای تولید پاسخ بر اساس متنی ضعیف، با «اطلاعات کافی در اختیار ندارم» پاسخ دهد.

دوم، در مرحله تولید، از Prompting مقید (Constrained Prompting) استفاده کنید که صریحاً به مدل دستور دهد در صورت ناکافی بودن شواهد، این موضوع را بیان کند. یک نمره اطمینان (Confidence score) در خروجی بگنجانید و پاسخ‌های با اطمینان پایین را برای بازبینی انسانی ارسال کنید.

سوم، در بخش مانیتورینگ، همبستگی میان امتیازات بازیابی و بازخورد کاربران را رهگیری کنید. اگر کاربران به پرس‌وجوهایی که امتیاز بازیابی بالایی داشته‌اند بازخورد منفی می‌دهند، به احتمال زیاد Reranker یا استراتژی Chunking علت اصلی مشکل است. گزارش کامل ردگیری (شامل پرس‌وجو، Chunkهای بازیابی‌شده، پاسخ تولیدشده و بازخورد کاربر) را ثبت کنید تا بتوانید موارد خاص شکست را دیباگ نمایید.

### پرسش: هزینه‌های سیستم RAG شما طی ماه گذشته بدون هیچ افزایشی در حجم پرس‌وجوها سه برابر شده است. چگونه این مسئله را ریشه‌یابی و رفع می‌کنید؟

**پاسخ قوی:**

من به این ترتیب بررسی خواهم کرد:

نخست، **نرخ اصابت به کَش (Cache hit rate)** را بررسی کنید. اگر این نرخ کاهش یافته باشد، به این معنی است که پرس‌وجوهای بیشتری به کل خط لوله ارسال می‌شوند. دلایل متداول: تغییر آستانه کَش معنایی، باطل‌سازی بیش از حد تهاجمی کَش (Cache invalidation) پس از به‌روزرسانی داده‌ها، یا تغییر در توزیع پرس‌وجوها به گونه‌ای که با پرس‌وجوهای کَش‌شده مطابقت ندارند.

دوم، **توزیع مسیریابی مدل (Model routing distribution)** را بررسی کنید. اگر دسته‌بندی‌کننده پرس‌وجو تعداد بیشتری از پرس‌وجوها را به مدل گران‌قیمت بزرگ هدایت کند، همین امر به تنهایی می‌تواند هزینه‌ها را سه برابر کند. بررسی کنید که آیا پیچیدگی پرس‌وجوها تغییر کرده است یا رفتار دسته‌بندی‌کننده دچار انحراف (Drift) شده است.

سوم، وضعیت **رفت‌وبرگشت‌های مکرر بازیابی (Retrieval thrash)** را در مسیرهای RAG مبتنی بر Agent بررسی کنید. اگر حلقه Corrective RAG دفعات بیشتری تکرار می‌شود (شاید به دلیل Embeddingهای قدیمی یا افت کیفیت بازیابی)، هر پرس‌وجو چندین فراخوانی بازیابی و تولید انجام می‌دهد. لاگ‌های ردگیری (Trace logs) میانگین تعداد تکرارها به ازای هر پرس‌وجو را نشان خواهند داد.

چهارم، **خط لوله Embedding** را بررسی کنید. اگر اسناد بدون ضرورت مجدداً Embedding می‌شوند (ورود داده تکراری، عدم حذف داده‌های تکراری/Deduplication)، هزینه‌های تولید Embedding ممکن است به شدت جهش یابد.

راهکار رفع مشکل به علت ریشه‌ای آن بستگی دارد، اما اقدامات متداول عبارتند از: تنظیم آستانه کَش معنایی، تعیین سقف هزینه برای هر پرس‌وجو جهت هدایت اجباری به مسیرهای ارزان‌ترِ جایگزین (Fallback)، رفع کهنگی Embeddingها برای کاهش حلقه‌های بازیابی اصلاحی، و افزودن قابلیت حذف داده‌های تکراری به خط لوله ورود داده.

---

## منابع

- آسای و همکاران. "Self-RAG: Learning to Retrieve, Generate, and Critique" (2024)
- یان و همکاران. "Corrective Retrieval Augmented Generation (CRAG)" (2024)
- شی و همکاران. "RAGRouter: Learning to Route Queries to Multiple RAL Models" (2025)
- ردیس (Redis). "RAG at Scale: How to Build Production AI Systems in 2026"
- آنتروپیک (Anthropic). "1M Token Context Window General Availability" (مارس ۲۰۲۶)
- فریم‌ورک RAGAS (RAGAS Framework). "Context Precision, Recall, Faithfulness, and Relevancy Metrics"
- آمازون وب سرویس (AWS). "Multi-Tenant RAG with Amazon Bedrock Knowledge Bases" (2025)
- مایکروسافت (Microsoft). "Design a Secure Multitenant RAG Inferencing Solution" (2025)
- مایکروسافت (Microsoft). "What's new in Azure AI Search" (بازیابی مبتنی بر Agent، نسخه 2026-08-01-preview)
- کلودفلر (Cloudflare). "AI Search is now generally available" و محدودیت‌ها و قیمت‌گذاری AI Search (اکتبر ۲۰۲۶)
- پاین‌کون (Pinecone). "Pinecone Nexus is generally available" (اوت ۲۰۲۶)
- کیودرانت (Qdrant). یادداشت‌های انتشار "Qdrant 1.19" (اوت ۲۰۲۶)
- لاگ تغییرات pgvector (CHANGELOG), 0.8.7 (اکتبر ۲۰۲۶)

---

*قبلی: [الگوهای ارزیابی RAG](13-rag-evaluation-patterns.md) | بعدی: [مهندسی داده برای هوش مصنوعی](15-data-engineering-for-ai.md)*

</div>
