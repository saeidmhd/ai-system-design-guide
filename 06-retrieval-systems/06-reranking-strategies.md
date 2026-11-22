<div dir="rtl">

# استراتژی‌های بازرتبه‌بندی (Reranking Strategies)

بازرتبه‌بندی (Reranking) مرحله دوم بازیابی است که مجموعه کوچکی از کاندیداها (Top 50-100) را با استفاده از یک مدل با دقت بالا (high-precision) مجدداً امتیازدهی می‌کند. این مرحله پلی میان «جستجوی کارآمد» و «پایه‌ریزی بی‌نقص (perfect grounding)» است: بازیابی مرحله اول برای پوشش (Recall) بهینه‌سازی می‌شود، در حالی که بازرتبه‌بندی برای دقت (Precision) بهینه‌سازی می‌گردد. گزینه‌های متداول در محیط عملیاتی، سرویس‌های میزبانی‌شده Cohere Rerank 5 (نسخه‌های Fast و Pro، عرضه عمومی یا GA در اکتبر ۲۰۲۶) و Voyage rerank-3 / rerank-3-lite با قیمت یکسان ۰.۰۲ دلار و ۰.۰۵ دلار به ازای هر ۱ میلیون Token، و همچنین مدل‌های با وزن باز (open-weight) شامل Qwen3-Reranker و bge-reranker-v2-m3 هستند. این انتخاب بر اساس مدل هزینه، دم تاخیر (Latency tail)، طول کانتکست (Context length)، پوشش زبانی، مجوز (License) و نیاز به وزن‌های قابل میزبانی اختصاصی (self-hostable) انجام می‌شود.

## فهرست مطالب

- [چرا بازرتبه‌بندی](#why-reranking)
- [معماری‌های بازرتبه‌بندی](#reranking-architectures)
- [مدل‌های بازرتبه‌بندی](#reranking-models)
- [الگوهای پیاده‌سازی](#implementation-patterns)
- [چه زمانی باید بازرتبه‌بندی کرد](#when-to-rerank)
- [بازرتبه‌بندی مبتنی بر LLM](#llm-based-reranking)
- [تقطیر SLM](#slm-distillation)
- [ملاحظات محیط عملیاتی](#production-considerations)
- [سوالات مصاحبه](#interview-questions)
- [منابع](#references)

---

## چرا بازرتبه‌بندی

### شکاف کیفیتی

| مرحله | مدل | سرعت | کیفیت |
|-------|-------|-------|---------|
| بازیابی امبدینگ | Bi-encoder | سریع (میلی‌ثانیه) | خوب |
| بازرتبه‌بندی | Cross-encoder | کند (۱۰-۱۰۰ میلی‌ثانیه) | بهتر |

**دلیل وجود این شکاف:**
- مدل‌های Bi-encoder کوئری و سند را به صورت مستقل از یکدیگر امبد (Embed) می‌کنند
- مدل‌های Cross-encoder کوئری و سند را به طور مشترک پردازش می‌کنند
- پردازش مشترک، تعاملاتی را دریافت و ثبت می‌کند که Bi-encoderها از دست می‌دهند

### مثال

```
Query: "How to configure CUDA memory"

Document 1: "Configure GPU memory using CUDA_VISIBLE_DEVICES..."
Document 2: "Memory management in CUDA applications..."
Document 3: "Configure RAM allocation for machine learning..."

Bi-encoder scores (cosine similarity):
- Doc 1: 0.72
- Doc 2: 0.75  <-- Ranked first (wrong)
- Doc 3: 0.71

Cross-encoder scores (relevance):
- Doc 1: 0.91  <-- Ranked first (correct)
- Doc 2: 0.67
- Doc 3: 0.42
```

مدل Cross-encoder متوجه می‌شود که «CUDA memory» در کوئری، با «GPU memory...CUDA» در Doc 1 مرتبط است.

---

## معماری‌های بازرتبه‌بندی

### مقایسه Bi-Encoder در برابر Cross-Encoder

**مدل Bi-Encoder (مرحله اول):**
```
Query --> Encoder --> Query Embedding -+
                                      +-> Similarity
Document --> Encoder --> Doc Embedding +
```
- از مرتبه O(1) به ازای هر سند (امبدینگ‌ها از قبل محاسبه شده‌اند)
- عدم توانایی در مشاهده تعاملات بین کوئری و سند

**مدل Cross-Encoder (بازرتبه‌بندی):**
```
[Query, Document] --> Encoder --> Relevance Score
```
- از مرتبه O(n) به ازای هر کوئری (پردازش هر کاندیدا)
- مشاهده کانتکست کامل کوئری و سند
- استفاده از **مکانیزم توجه (Attention Mechanism)** برای مقایسه نحوه تغییر معنای کلمات سند توسط کلمات خاص در کوئری (تعامل کامل و اولیه یا early interaction؛ «تعامل دیرهنگام یا late interaction» در ColBERT بین این مدل و یک Bi-encoder قرار می‌گیرد)

### پایپ‌لاین دو مرحله‌ای

سیستم‌های بازیابی در محیط عملیاتی از یک قیف دو مرحله‌ای استفاده می‌کنند:

<div dir="ltr">

```
+----------------------------------------------------------------+
|  STAGE 1: Retrieval (Bi-Encoder)                                |
|                                                                 |
|  Query --> Embed --> Top-K candidates (K=100)                   |
|  Scale: Search 1 Billion docs. Cost: Low (ms).                 |
+----------------------------+-----------------------------------+
                             |
                             v
+----------------------------------------------------------------+
|  STAGE 2: Reranking (Cross-Encoder)                             |
|                                                                 |
|  For each candidate:                                            |
|    score = reranker([query, candidate])                         |
|  Scale: Search Top 100 docs. Cost: High (10-100ms).            |
|                                                                 |
|  Return Top-N by reranker score (N=5-10)                        |
+----------------------------------------------------------------+
```

</div>

### پایپ‌لاین چند مرحله‌ای

برای پیکره‌های متنی (Corpora) بسیار بزرگ:

```
Stage 1: Sparse (BM25)      -> Top 1000
Stage 2: Dense (Bi-encoder) -> Top 100
Stage 3: Cross-encoder      -> Top 10
```

هر مرحله سرعت را در ازای دقت مبادله می‌کند.

---

## مدل‌های بازرتبه‌بندی

### مدل‌های Cross-Encoder

| مدل | اندازه / دسترسی | کانتکست | مجوز یا قیمت | توضیحات |
|-------|---------------|---------|------------------|-------|
| ms-marco-MiniLM-L-6 | 22M، باز | 512 | Apache 2.0 | انگلیسی؛ بیس‌لاین مناسب برای CPU |
| bge-reranker-base | 278M، باز | 512 | MIT | انگلیسی |
| **bge-reranker-v2-m3** | 568M، باز | ۵۱۲ در نمونه‌های کارت مدل (پایه 8K) | Apache 2.0 | ابزار پرکاربرد چندزبانه |
| **Cohere Rerank 5** (`rerank-v5.0-pro` / `-fast`) | API، فقط متن | 32K | ۰.۰۵ دلار (Pro) / ۰.۰۲ دلار (Fast) به ازای هر ۱ میلیون Token | عرضه عمومی (GA) در ۲۱ اکتبر ۲۰۲۶. امتیازها کالیبره شده‌اند تا به صورت احتمال مفید بودن یک سند خوانده شوند، و Context Focus بخش‌ها (اسپن‌های) امتیازدهی‌شده را در داخل هر سند بازمی‌گرداند. Rerank 4 (`rerank-v4.0-pro` / `-fast`، با کانتکست 32K) و Rerank 3.5 (با کانتکست 4K) همچنان در فهرست قرار دارند |
| **Voyage rerank-3 / rerank-3-lite** | API | 32K | ۰.۰۵ دلار / ۰.۰۲ دلار به ازای هر ۱ میلیون Token | ۳۰ سپتامبر ۲۰۲۶؛ قیمت‌ها و API یکسان با rerank-2.5، و آستانه‌های امتیاز تنظیم‌شده روی 2.5 همچنان کار می‌کنند |
| **Qwen3-Reranker-8B** | 8B، باز | 32K | Apache 2.0 | بازرتبه‌بندی‌کننده متنی متن‌باز قدرتمند (ژوئن ۲۰۲۵) |
| **Qwen3-VL-Reranker-2B / 8B** | باز | 32K | Apache 2.0 | چندوجهی (متن، تصاویر، اسکرین‌شات‌های صفحه)، ژانویه ۲۰۲۶ |
| jina-reranker-v3.5 | 0.6B، باز | طولانی | CC BY-NC 4.0 (غیرتجاری) | بازرتبه‌بندی‌کننده فهرستی (Listwise) بر پایه Qwen3-0.6B؛ استفاده تجاری از طریق API شرکت Jina یا مجوز جداگانه امکان‌پذیر است |
| LightOn-rerank | 0.8B / 2B / 4B، باز | طولانی | بررسی کارت مدل | انواع نقطه‌ای (Pointwise) و فهرستی (Listwise) بر روی ستون فقرات Qwen3.5 (ژوئیه ۲۰۲۶) |

شرکت Voyage گزارش می‌دهد که rerank-3 با اختلاف ۰.۹۶٪ در کل و ۳.۳۵٪ در اسناد طولانی از rerank-2.5، و با اختلاف ۲.۷۲٪ در کل و ۱۳.۸۴٪ در اسناد طولانی از Cohere Rerank v4.0 Pro برتری داشته است (گزارش‌شده توسط ارائه‌دهنده، روی ۹۵ مجموعه داده به همراه MAIR). سه هفته بعد، Cohere گزارش داد که Rerank 5 Pro در BRIGHT امتیاز ۸۲.۲ را کسب کرده که ۵.۸ امتیاز بالاتر از Voyage rerank-3 و ۱۲.۴ امتیاز بالاتر از Rerank 4 Pro خود Cohere است (گزارش‌شده توسط ارائه‌دهنده). هر ارائه‌دهنده در جدول خودش برنده است. هر دو گزارش را به جای یک رتبه‌بندی بی‌طرفانه، سیگنال‌هایی درباره محل تمرکز دستاوردها و بهبودهای کنونی (اسناد طولانی، ارتباط مبتنی بر استدلال سنگین و پیروی از دستورالعمل‌ها) در نظر بگیرید.

**امتیازهای کالیبره‌شده، نحوه برش دادن لیست را تغییر می‌دهند.** Cohere خطای کالیبراسیون مورد انتظار (ECE) را برای Rerank 5 حدود ۰.۰۶ در مقایسه با ۰.۳۸ برای Rerank 4 Pro و ۰.۲۳ برای Voyage rerank-3 گزارش می‌دهد (گزارش‌شده توسط ارائه‌دهنده)، و آستانه‌های ۰.۵۰ (Pro) و ۰.۴۵ (Fast) را به عنوان نقطه برش «مفید بودن» پیشنهاد می‌کند. اگر این امر بر روی داده‌های شما نیز صادق باشد، یک آستانه امتیاز می‌تواند جایگزین top-k ثابت شود؛ به این ترتیب کوئری‌های آسان دو قطعه (Chunk) و کوئری‌های دشوار ده قطعه ارسال می‌کنند. دو نکته احتیاطی: آستانه‌های تنظیم‌شده بر روی Rerank 4 قابل انتقال نیستند، زیرا مقیاس امتیازها تغییر کرده است؛ همچنین کالیبراسیون روی مجموعه‌های آزمایشی Cohere به معنای کالیبراسیون روی داده‌های شما نیست، بنابراین آستانه برش را روی مجموعه طلایی (Golden set) خود مجدداً برازش کنید. قابلیت Context Focus همین ایده را در داخل سند با بازگرداندن بخش‌ها (اسپن‌های) امتیازدهی‌شده پیاده می‌کند؛ Cohere گزارش می‌دهد که با حذف نیمی از کانتکست، ۹۶٪ از کیفیت پاسخ حفظ می‌شود. پیرایش اسپن‌ها (Span trimming) را به عنوان اهرمی برای بودجه‌بندی کانتکست در نظر بگیرید و وفاداری پاسخ (Faithfulness) را پس از آن ارزیابی کنید، چرا که حذف یک قید یا واژه توصیفی می‌تواند پاسخ را کاملاً دگرگون کند.

**اگر مدل خود را Fine-tuning می‌کنید، یک بازرتبه‌بندی‌کننده آموزش دهید، نه یک قاضی بله/خیر.** مقاله arXiv 2610.32318 («مدل‌های سیستم یک بازرتبه‌بندی‌کننده‌های بهتری نیستند»، ۲۳ اکتبر ۲۰۲۶) شش ستون فقرات Qwen از 0.6B تا 27B را یا به عنوان بازرتبه‌بندی‌کننده یا به عنوان مدل‌های تصمیم‌گیری (Decision models) تحت Fine-tuning قرار داد و آن‌ها را روی ده مجموعه TREC DL و BEIR آزمایش کرد. از 0.6B تا 9B، مدل‌های Fine-tuning شده به عنوان بازرتبه‌بندی‌کننده در تمام ستون‌های فقرات، بین ۵ تا ۲۹ امتیاز nDCG@10 از مدل‌های Fine-tuning شده تصمیم‌گیری بهتر عمل کردند (شامل مجموعه‌های zero-shot)، و Fine-tuning تصمیم‌گیری هیچ مزیتی نسبت به پرسش از مدل تنظیم‌نشده اضافه نکرد؛ تنها در مدل 27B این دو نتیجه برابری ثبت کردند. مزیت کالیبراسیون مدل‌های تصمیم‌گیری (در 4B به بالا) هنگامی که سوال از تعریف بازتری از ارتباط استفاده می‌کرد از بین رفت، که همان درس آستانه‌های برش Cohere را یادآوری می‌کند: کالیبراسیون به یک سوال خاص در یک توزیع داده خاص تعلق دارد، بنابراین هر زمان که هر یک تغییر کرد، آستانه‌ها را مجدداً برازش کنید.

**راهکار رفع مشکل «گم‌شدن در میانه» (Lost in the Middle):** بازرتبه‌بندی‌کننده‌ها طوری آموزش دیده‌اند که اطلاعات مرتبط را صرف‌نظر از موقعیت قرارگیری آن‌ها در قطعه (Chunk) اولویت‌بندی کنند، و اطمینان حاصل نمایند که داده‌های موجود در «میانه» متن، پیش از ارسال به LLM نهایی به درستی امتیازدهی می‌شوند.

### استفاده از Cross-Encoderها

```python
from sentence_transformers import CrossEncoder

# Load model
reranker = CrossEncoder('BAAI/bge-reranker-base')

def rerank(query: str, documents: list[str], top_k: int = 5) -> list[tuple[str, float]]:
    # Create pairs
    pairs = [[query, doc] for doc in documents]

    # Score all pairs
    scores = reranker.predict(pairs)

    # Sort by score
    scored_docs = sorted(
        zip(documents, scores),
        key=lambda x: x[1],
        reverse=True
    )

    return scored_docs[:top_k]
```

### ابزار Cohere Rerank

```python
import cohere

co = cohere.ClientV2()  # reads CO_API_KEY from the environment

def cohere_rerank(
    query: str,
    documents: list[str],
    top_k: int = 5
) -> list[dict]:
    response = co.rerank(
        model="rerank-v5.0-pro",  # or "rerank-v5.0-fast" for lower latency
        query=query,
        documents=documents,
        top_n=top_k,
    )

    # v2 results carry index and relevance_score; map back to the input list
    return [
        {
            "text": documents[result.index],
            "score": result.relevance_score,
            "index": result.index
        }
        for result in response.results
    ]
```

### راهنمای انتخاب مدل

| مورد کاربرد | مدل پیشنهادی | توضیحات |
|----------|-------------------|-------|
| انگلیسی، میزبانی اختصاصی (self-hosted)، بر بستر CPU | bge-reranker-base یا MiniLM-L-6 | مدل MiniLM با کیفیت پایین‌تر حدود ۴ برابر سریع‌تر است |
| چندزبانه، میزبانی اختصاصی (self-hosted) | bge-reranker-v2-m3 یا Qwen3-Reranker | مدل Qwen3 برای ورودی‌های طولانی در صورت در دسترس بودن GPUها |
| بالاترین کیفیت، مدیریت‌شده (Managed) | Cohere Rerank 5 Pro یا Voyage rerank-3 | هر دو ۰.۰۵ دلار به ازای هر ۱ میلیون Token؛ هر دو را روی داده‌های خود بنچمارک کنید، زیرا آمار ارائه‌دهندگان با یکدیگر همخوانی ندارند |
| حساس به هزینه، مدیریت‌شده (Managed) | Voyage rerank-3-lite یا Cohere Rerank 5 Fast | هر دو ۰.۰۲ دلار به ازای هر ۱ میلیون Token |
| اسناد طولانی یا خروجی‌های ابزار (8K+) | هر بازرتبه‌بندی‌کننده 32K (شامل Cohere Rerank 5، Voyage rerank-3، Qwen3) | بریده شدن متن (Truncation) دیگر محدودیت نیست؛ هزینه بر اساس Token به ازای هر جفت تعیین می‌شود |
| اسکرین‌شات صفحات، نمودارها | Qwen3-VL-Reranker | لایسنس Apache 2.0، چندوجهی |

**برآورد هزینه:** بازرتبه‌بندی ۵۰ کاندید با حدود ۵۰۰ Token، تقریباً معادل ۲۵ هزار Token به ازای هر کوئری است. با هزینه ۰.۰۵ دلار به ازای هر ۱ میلیون Token (در Voyage rerank-3 یا Cohere Rerank 5 Pro)، این مقدار تقریباً معادل ۰.۰۰۱۲۵ دلار به ازای هر کوئری، یا حدود ۱,۲۵۰ دلار در روز برای ۱ میلیون کوئری خواهد بود. قیمت‌گذاری بر اساس هر Token به این معنی است که قطعه‌های (Chunkهای) طولانی و فهرست‌های کاندیدای عمیق‌تر، هزینه را به صورت خطی افزایش می‌دهند؛ بنابراین عمق کاندیداها و طول قطعه‌ها، علاوه بر اهرم‌های تاخیر (Latency)، اهرم‌های هزینه نیز به شمار می‌روند.

---

## الگوهای پیاده‌سازی

### الگوی ۱: بازرتبه‌بندی پایه

```python
class RerankedRetriever:
    def __init__(
        self,
        vector_db,
        embedding_model,
        reranker,
        retrieval_k: int = 50,
        rerank_k: int = 5
    ):
        self.vector_db = vector_db
        self.embedding_model = embedding_model
        self.reranker = reranker
        self.retrieval_k = retrieval_k
        self.rerank_k = rerank_k

    def search(self, query: str) -> list[Document]:
        # Stage 1: Retrieve candidates
        query_embedding = self.embedding_model.encode(query)
        candidates = self.vector_db.search(
            query_embedding,
            top_k=self.retrieval_k
        )

        # Stage 2: Rerank
        pairs = [[query, c.text] for c in candidates]
        scores = self.reranker.predict(pairs)

        # Combine and sort
        for candidate, score in zip(candidates, scores):
            candidate.rerank_score = score

        reranked = sorted(candidates, key=lambda x: x.rerank_score, reverse=True)
        return reranked[:self.rerank_k]
```

### الگوی ۲: بازرتبه‌بندی دسته‌ای (Batched)

```python
def batch_rerank(
    queries: list[str],
    candidates_per_query: list[list[str]],
    reranker,
    batch_size: int = 32
) -> list[list[tuple[str, float]]]:
    # Flatten all pairs
    all_pairs = []
    pair_mapping = []  # (query_idx, doc_idx)

    for q_idx, (query, candidates) in enumerate(zip(queries, candidates_per_query)):
        for d_idx, doc in enumerate(candidates):
            all_pairs.append([query, doc])
            pair_mapping.append((q_idx, d_idx))

    # Batch score
    all_scores = []
    for i in range(0, len(all_pairs), batch_size):
        batch = all_pairs[i:i + batch_size]
        scores = reranker.predict(batch)
        all_scores.extend(scores)

    # Reconstruct per-query results
    results = [[] for _ in queries]
    for (q_idx, d_idx), score in zip(pair_mapping, all_scores):
        results[q_idx].append((candidates_per_query[q_idx][d_idx], score))

    # Sort each query's results
    for i in range(len(results)):
        results[i].sort(key=lambda x: x[1], reverse=True)

    return results
```

### الگوی ۳: بازرتبه‌بندی ناهمگام (Async)

```python
import asyncio

class AsyncReranker:
    def __init__(self, reranker, max_concurrent: int = 5):
        self.reranker = reranker
        self.semaphore = asyncio.Semaphore(max_concurrent)

    async def rerank_async(
        self,
        query: str,
        documents: list[str]
    ) -> list[tuple[str, float]]:
        async with self.semaphore:
            # Run reranking in thread pool
            loop = asyncio.get_event_loop()
            scores = await loop.run_in_executor(
                None,
                lambda: self.reranker.predict([[query, doc] for doc in documents])
            )
            return sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
```

---

## چه زمانی از رتبه‌بندی مجدد (Reranking) استفاده کنیم

### تحلیل هزینه-فایده (Cost-Benefit Analysis)

| فاکتور | بدون رتبه‌بندی مجدد | با رتبه‌بندی مجدد |
|--------|-------------------|----------------|
| تاخیر (Latency) | 50-100ms | 150-300ms |
| کیفیت (NDCG) | 0.65 | 0.78 |
| پیچیدگی | ساده | متوسط |
| هزینه | خط پایه (Baseline) | هزینه API بیشتر یا پردازش بیشتر |

### فریم‌ورک تصمیم‌گیری (Decision Framework)

**همیشه رتبه‌بندی مجدد را انجام دهید زمانی که:**
- کیفیت اهمیت حیاتی دارد (سیستم‌های سمت کاربر، تصمیم‌گیری‌های حساس و پرریسک)
- کاندیداهای بازیابی‌شده امتیازهای مشابهی دارند
- پرس‌وجو (Query) پیچیده یا چندبخشی است
- بودجه زمانی اجازه افزایش تاخیر (Latency) را می‌دهد

**از رتبه‌بندی مجدد صرف‌نظر کنید زمانی که:**
- بودجه تاخیر (Latency) بسیار محدود است (کمتر از 100ms در مجموع)
- کاندیداهای بازیابی‌شده دارای رتبه‌بندی کاملاً واضح و متمایز هستند
- پرس‌وجوها ساده هستند (جستجوهای تک‌کلمه‌ای)
- در مقیاس بالا با محدودیت شدید هزینه مواجه هستید

### موازنه‌های زمان استنتاج (Inference)

| مرحله | بازیابی (K) | رتبه‌بندی مجدد (N) | تاخیر (Latency) | کیفیت |
|-------|---------------|------------|---------|---------|
| **ساده (Naive)** | 5 | 0 | 50ms | پایین |
| **استاندارد (Standard)** | 50 | 5 | 150ms | بالا |
| **سازمانی (Enterprise)**| 200 | 20 | 500ms | حداکثر |

**قاعده کلیدی**: اگر بودجه‌ای معادل 200ms دارید، 50ms را به بازیابی و 150ms را به رتبه‌بندی مجدد اختصاص دهید. رتبه‌بندی مجدد ۵۰ نتیجه برتر (Top 50)، نرخ بازگشت سرمایه (ROI) بسیار بالاتری نسبت به بازیابی چانک‌های بیشتر از پایگاه داده برداری (Vector Database) فراهم می‌کند.

### تعداد بهینه کاندیداها (Optimal Candidate Count)

چه تعداد کاندیدا باید قبل از رتبه‌بندی مجدد بازیابی شوند:

```python
def optimize_candidate_count(test_set, retriever, reranker):
    """Find optimal retrieval_k for reranking."""
    results = {}

    for retrieval_k in [10, 20, 50, 100, 200]:
        ndcg_scores = []
        latencies = []

        for query, relevant_docs in test_set:
            start = time.time()

            # Retrieve
            candidates = retriever.search(query, top_k=retrieval_k)

            # Rerank to top 5
            reranked = reranker.rerank(query, candidates, top_k=5)

            latency = time.time() - start
            latencies.append(latency)

            ndcg = compute_ndcg(reranked, relevant_docs)
            ndcg_scores.append(ndcg)

        results[retrieval_k] = {
            "ndcg": mean(ndcg_scores),
            "latency_p99": percentile(latencies, 99)
        }

    return results

# Typical findings:
# K=20:  NDCG 0.72, latency 120ms
# K=50:  NDCG 0.76, latency 180ms  <-- Often sweet spot
# K=100: NDCG 0.77, latency 280ms  <-- Diminishing returns
```

---

## رتبه‌بندی مجدد مبتنی بر LLM (LLM-Based Reranking)

### استفاده از LLMها به عنوان رتبه‌بندی‌کننده (Rerankers)

مدل‌های LLM می‌توانند میزان ارتباط را امتیازدهی کنند، اما گران‌قیمت هستند:

```python
def llm_rerank(
    query: str,
    documents: list[str],
    model: str = "gpt-6-luna"
) -> list[tuple[str, float]]:
    prompt = f"""Rate the relevance of each document to the query.
Query: {query}

Documents:
{format_documents(documents)}

For each document, output a relevance score from 0-10.
Format: DOC_NUM: SCORE
"""

    response = llm.generate(prompt)
    scores = parse_scores(response)

    return sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
```

**مزایا:**
- توانایی مدیریت قضاوت‌های پیچیده در مورد میزان ارتباط
- درک تفاوت‌های ظریف معنایی (Nuance) و زمینه (Context)
- عدم نیاز به نگهداری مدلی مجزا

**معایب:**
- گران‌قیمت در مقیاس بالا (۱۰ تا ۱۰۰ برابر کراس-انکودر)
- کندتر (۱ تا ۳ ثانیه در مقایسه با 100ms)
- غیرقطعی (Non-deterministic)

**اعداد و ارقام چه می‌گویند:** مقاله «معمای امبدینگ‌ساز» ("The Embedder's Dilemma" - arXiv 2608.12875، آگوست ۲۰۲۶) تعداد ۱۰ مدل LLM را در ۳۷ تسک به سبک MTEB با ۲۶ مدل امبدینگ مقایسه کرد. بهترین LLM در مجموع به نتیجه‌ای برابر با بهترین مدل امبدینگ دست یافت (77.6 در برابر 77.2)، اما با هزینه‌ای تا ۱٬۴۳۱ برابر بیشتر؛ مدل‌های LLM در بازیابی‌های مبتنی بر استدلال سنگین پیشتاز بودند و مدل‌های امبدینگ در دسته‌بندی. Tokenهای استدلال بین ۲۸٪ تا ۸۱٪ از هزینه LLM را تشکیل می‌دادند، و بودجه‌های استدلال پایین‌تر معمولاً کیفیت بازیابی را حفظ می‌کردند. از این موضوع دو قاعده به دست می‌آید: از LLM تنها برای تعداد انگشت‌شماری از کاندیداهای نهایی در پرس‌وجوهایی که نیازمند استدلال هستند استفاده کنید، و آن را در پایین‌ترین تنظیمات سطح تلاش (effort setting) که کیفیت را در مجموعه ارزیابی (eval set) شما حفظ می‌کند، اجرا نمایید.

### رتبه‌بندی مجدد مبتنی بر LLM: روش Listwise در برابر Pointwise

**روش Pointwise:** امتیازدهی مستقل به هر سند
```
For document: [doc text]
Query: [query]
Rate relevance 0-10: _
```

**روش Listwise:** رتبه‌بندی تمام اسناد در کنار یکدیگر
```
Query: [query]
Rank these documents by relevance:
A: [doc1]
B: [doc2]
C: [doc3]
Output order: _
```

**روش Listwise معمولاً بهتر است** زیرا LLM می‌تواند اسناد را مستقیماً با یکدیگر مقایسه کند. مدل‌های کوچک کنونی (GPT-6 Luna، Claude Haiku 5.5) رتبه‌بندی Listwise را به اندازه‌ای ارزان می‌کنند که با تلاش کم قابل امتحان باشد، اما باید کیفیت آن را روی مجموعه ارزیابی (eval set) خود بررسی کنید؛ این روش همچنان ۱ تا ۲ ثانیه تاخیر (Latency) اضافه می‌کند، بنابراین آن را برای جستجوهای سازمانی با ریسک بالا (حقوقی، پزشکی) نگه دارید. مدل‌های اختصاصی رتبه‌بندی مجدد Listwise (مانند jina-reranker-v3.5 و نسخه‌های Listwise از LightOn-rerank) مقایسه بین‌اسنادی را با تاخیر (Latency) در حد کراس-انکودر در اختیارتان قرار می‌دهند.

### پنجره لغزان (Sliding Window) برای اسناد زیاد

```python
def sliding_window_rerank(
    query: str,
    documents: list[str],
    window_size: int = 10,
    step: int = 5
) -> list[str]:
    """Rerank many documents with LLM using sliding window."""
    ranked = list(range(len(documents)))

    for start in range(0, len(documents), step):
        window = ranked[start:start + window_size]

        # LLM ranks this window
        window_docs = [documents[i] for i in window]
        window_order = llm_listwise_rank(query, window_docs)

        # Update rankings
        for new_pos, old_idx in enumerate(window_order):
            ranked[start + new_pos] = window[old_idx]

    return [documents[i] for i in ranked]
```

---

## تقطیر مدل‌های زبانی کوچک (SLM Distillation)

برای کاهش تاخیر (Latency) رتبه‌بندی مجدد مبتنی بر LLM، قضاوت‌های LLM را در یک **کراس-انکودر کوچک (SLM)** تقطیر (Distill) کنید.

- **فرایند**: یک مدل پیشرو (frontier model) را به کار بگیرید تا ۱ میلیون جفت را رتبه‌بندی مجدد کند، و از این برچسب‌ها برای «تقطیر» یک مدل بسیار کوچک 0.1B پارامتری استفاده نمایید. پیش از انجام این کار با یک API تجاری، شرایط و قوانین ارائه‌دهنده را در مورد آموزش مدل‌ها با خروجی‌های آن بررسی کنید.
- **نتیجه**: مدل دانش‌آموز (Student) با تاخیر (Latency) در سطح کراس-انکودر اجرا می‌شود (۱۰۰ تا ۲۰۰ میلی‌ثانیه برای ۵۰ کاندیدا طبق بودجه‌های این فصل، در مقایسه با ۱ تا ۳ ثانیه برای یک مرحله اجرای LLM) و بخش زیادی از کیفیت رتبه‌بندی آموزگار را در پرس‌وجوهای درون‌دامنه (in-domain) حفظ می‌کند. اینکه چه مقدار از کیفیت حفظ می‌شود وابسته به مجموعه‌داده (Corpus) است و این فاصله در خارج از دامنه بیشتر می‌شود؛ بنابراین قبل از کنار گذاشتن مسیر LLM، معیار NDCG@10 را در برابر مدل آموزگار روی مجموعه طلایی (golden set) خود مقایسه کنید.
- **الگوی محیط عملیاتی:** در حالت معمول از کراس-انکودر استفاده کنید و از LLM به عنوان راهکار جایگزین (Fallback) برای امتیازهای رتبه‌بندی مجدد با ضریب اطمینان پایین بهره ببرید.

---

## ملاحظات محیط عملیاتی

### بهینه‌سازی تاخیر (Latency)

```python
class OptimizedReranker:
    def __init__(self, model_name: str, device: str = "cuda"):
        self.model = CrossEncoder(model_name, device=device)
        # Enable optimizations
        self.model.model.half()  # FP16

    def rerank(self, query: str, documents: list[str]) -> list[tuple[str, float]]:
        with torch.inference_mode():
            pairs = [[query, doc] for doc in documents]
            scores = self.model.predict(
                pairs,
                batch_size=32,
                show_progress_bar=False
            )
        return sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
```

**تکنیک‌های بهینه‌سازی:**
- استنتاج (Inference) با دقت FP16: دو برابر افزایش سرعت
- دسته‌بندی (Batching): سرشکن کردن بار پردازشی اضافه (Overhead)
- خروجی گرفتن به صورت ONNX: ۱.۵ تا ۲ برابر افزایش سرعت
- TensorRT: ۲ تا ۳ برابر افزایش سرعت (NVIDIA)
- تقطیر مدل (Model distillation): ۴ برابر افزایش سرعت با مصالحه در کیفیت

### پس از مدل رتبه‌بندی مجدد: تنوع و قوانین کسب‌وکار

یک مدل رتبه‌بندی مجدد به هر کاندیدا بدون در نظر گرفتن سایرین امتیاز می‌دهد، بنابراین سه چانک تقریباً یکسان از یک منبع می‌توانند سه رتبه اول را تصاحب کنند. تنوع‌بخشی (MMR) و قوانین کسب‌وکار (کاهش ارزش با گذشت زمان، «اولویت دادن به مستندات رسمی») را **بعد از** امتیازدهی میزان ارتباط اعمال کنید، نه قبل از آن؛ در غیر این صورت مدل رتبه‌بندی مجدد اثر آن‌ها را از بین خواهد برد. برخی موتورها امروزه این کار را در داخل پایگاه داده انجام می‌دهند: Weaviate 1.39 قابلیت MMR و یک Boost API (ترفیع یا تنزل رتبه بر اساس فیلتر، ویژگی، زوال زمانی یا زوال عددی) را به صورت در دسترس عموم (GA) ارائه کرد، و قابلیت Function Chain در Milvus 3.0 مراحل امتیازدهی مجدد و رتبه‌بندی مجدد را در سمت سرور ترکیب می‌کند.

### کش کردن نتایج مدل رتبه‌بندی مجدد

```python
class CachedReranker:
    def __init__(self, reranker, cache_ttl: int = 3600):
        self.reranker = reranker
        self.cache = TTLCache(maxsize=10000, ttl=cache_ttl)

    def rerank(self, query: str, documents: list[str]) -> list[tuple[str, float]]:
        # Cache key includes query and doc hashes
        key = self._make_key(query, documents)

        if key in self.cache:
            return self.cache[key]

        result = self.reranker.rerank(query, documents)
        self.cache[key] = result
        return result

    def _make_key(self, query: str, documents: list[str]) -> str:
        doc_hash = hashlib.sha256(
            "".join(sorted(documents)).encode()
        ).hexdigest()[:16]
        query_hash = hashlib.sha256(query.encode()).hexdigest()[:16]
        return f"{query_hash}:{doc_hash}"
```

### استراتژی جایگزین (Fallback Strategy)

```python
def rerank_with_fallback(
    query: str,
    candidates: list[Document],
    primary_reranker,
    timeout: float = 2.0
) -> list[Document]:
    try:
        # Try reranking with timeout
        result = timeout_call(
            primary_reranker.rerank,
            args=(query, candidates),
            timeout=timeout
        )
        return result
    except TimeoutError:
        # Fallback: return original order
        logger.warning("Reranker timeout, using original order")
        return candidates
    except Exception as e:
        logger.error(f"Reranker error: {e}")
        return candidates
```

---

## سوالات مصاحبه

### پرسش: چرا یک کراس-انکودر از اساس دقیق‌تر از یک بای-انکودر است؟

**پاسخ قوی:**
یک بای-انکودر (Bi-Encoder) *قبل از* مشخص شدن هرگونه پرس‌وجو، یک نمایش برداری ایستا و واحد برای یک سند می‌سازد. این کار باعث از دست رفتن روابط خاص میان بخش‌های مختلف متن می‌شود. یک کراس-انکودر (Cross-Encoder) هم پرس‌وجو و هم سند را به عنوان یک جفت ورودی واحد دریافت می‌کند و از **مکانیسم توجه (Attention Mechanism)** برای مقایسه آن‌ها استفاده می‌کند. این مدل در هر لایه می‌تواند ببیند که چگونه کلمات خاص در پرس‌وجو معنای کلمات درون سند را تغییر می‌دهند (توجه متقاطع کامل یا full cross-attention، نه تعامل دیرهنگام به سبک ColBERT)؛ این ویژگی امکان امتیازدهی بسیار دقیق‌تر و ظریف‌تری را نسبت به شباهت ریاضی ساده بین دو بردار ثابت فراهم می‌سازد.

**در عمل:** از بای-انکودر برای بازیابی مرحله اول (سرعت) و از کراس-انکودر برای رتبه‌بندی مجدد (کیفیت) استفاده کنید. این کار بهترین ویژگی‌های هر دو را به همراه دارد.

### پرسش: چگونه تعیین می‌کنید چه تعداد کاندیدا را رتبه‌بندی مجدد کنید؟

**پاسخ قوی:**
ایجاد موازنه بین کیفیت و تاخیر (Latency):

**فاکتورها:**
- تاخیر (Latency) مدل رتبه‌بندی مجدد به ازای هر سند
- کل بودجه تاخیر (Latency)
- منحنی بهبود کیفیت (معمولاً بازده نزولی)
- کیفیت بازیابی در مرحله اول

**فرایند:**
۱. بنچمارک کردن تاخیر (Latency) مدل رتبه‌بندی مجدد به ازای هر سند
۲. محاسبه حداکثر کاندیداها در چارچوب بودجه تاخیر (Latency)
۳. تست کیفیت در مقادیر مختلف K
۴. یافتن نقطه زانویی (کیفیت در برابر تاخیر (Latency))

**یافته‌های معمول:**
- مقدار K=20-50 اغلب بهینه است
- فراتر از K=100، افزایش کیفیت بسیار اندک است
- تنظیم بر اساس کیفیت بازیابی مرحله اول

برای یک بودجه رتبه‌بندی مجدد 200ms با زمان 4ms به ازای هر سند، من حدود ۵۰ کاندیدا را رتبه‌بندی مجدد خواهم کرد.

### پرسش: چه زمانی از رتبه‌بندی مجدد مبتنی بر LLM استفاده می‌کنید؟

**پاسخ قوی:**
رتبه‌بندی مجدد با LLM در موارد زیر منطقی است:

۱. **قضاوت‌های پیچیده درباره میزان ارتباط:** پرس‌وجو نیاز به درک نکات ظریف، زمینه یا استدلال چندمرحله‌ای (multi-hop reasoning) دارد
۲. **حجم کم:** توجیه اقتصادی برای آموزش یا میزبانی یک کراس-انکودر وجود ندارد
۳. **نیاز به بالاترین کیفیت ممکن:** حوزه‌های حقوقی، پزشکی، سیستم‌های حساس و بحرانی
۴. **استفاده قبلی از LLM در پایپ‌لاین:** هزینه نهایی کمتر است

**هشدارها:**
- پرهزینه در مقیاس بالا (۱۰ تا ۱۰۰ برابر کراس-انکودر)
- کندتر (۱ تا ۳ ثانیه در برابر 100ms)
- غیرقطعی (Non-deterministic)
- ممکن است به مهندسی Prompt دقیق نیاز داشته باشد

**الگوی محیط عملیاتی:** در حالت عادی از کراس-انکودر استفاده کنید و از LLM به عنوان راهکار جایگزین (Fallback) در صورت پایین بودن امتیاز اطمینان رتبه‌بندی مجدد بهره ببرید.

### پرسش: چگونه رتبه‌بندی مجدد را برای پرس‌وجوهای بسیار طولانی (مثلاً یک پاراگراف کامل) مدیریت می‌کنید؟

**پاسخ قوی:**
کراس-انکودرهای کلاسیک با ابعاد BERT (مانند MiniLM و bge-reranker-base) به 512 Token محدود هستند، بنابراین پرس‌وجوها و چانک‌های طولانی کوتاه (Truncate) می‌شوند. راه‌حل‌های قدیمی **رتبه‌بندی مجدد با پنجره لغزان (Sliding Window Reranking)** یا **خلاصه‌سازی پرس‌وجو (Query Summarization)** بودند. مدل‌های رتبه‌بندی مجدد فعلی این محدودیت را تغییر داده‌اند: Cohere Rerank 5، Voyage rerank-3 و رتبه‌بندی‌کننده‌های Qwen3 تا 32K Token را دریافت می‌کنند؛ بنابراین اکنون مسئله به جای کوتاه‌سازی، هزینه و تاخیر (Latency) به ازای هر جفت است، زیرا هم قیمت‌گذاری به ازای هر Token و هم هزینه محاسباتی توجه با طول ورودی افزایش می‌یابند. الگوی من: یک دور رتبه‌بندی مجدد سریع اولیه روی ۵۰ کاندیدا با چانک‌های خلاصه‌شده/کوتاه‌شده، سپس دور دوم روی ۵ تا ۱۰ نتیجه برتر با متن کامل روی یک مدل رتبه‌بندی مجدد با ظرفیت 32K. این موضوع بیش از همه در RAG مبتنی بر Agent (agentic RAG) اهمیت دارد، جایی که «اسناد» خروجی‌های طولانی ابزارها هستند و پرس‌وجو یک پاراگراف شامل معیارهای سنجش ارتباط به زبان طبیعی است؛ یعنی دقیقاً جایی که Voyage بیشترین بهبودهای rerank-3 را گزارش کرده است (اسناد طولانی و مجموعه‌داده سنجش پیروی از دستورالعمل MAIR، گزارش‌شده توسط ارائه‌دهنده).

---

## مراجع

- Nogueira and Cho. "Passage Re-ranking with BERT" (2019)
- Nogueira et al. "Multi-Stage Document Ranking with BERT" (2019/2025 update)
- BAAI BGE Reranker: https://huggingface.co/BAAI/bge-reranker-base
- Cohere Rerank: https://docs.cohere.com/docs/rerank
- [Voyage AI. "rerank-3" (سپتامبر ۲۰۲۶)](https://blog.voyageai.com/2026/09/30/rerank-3/)
- [Cohere. "Rerank 5" (اکتبر ۲۰۲۶)](https://cohere.com/blog/rerank-5)
- [Dinzinger, Ghosh Dastidar, Granitzer. "System One models Are Not Better Rerankers" (arXiv 2610.32318، اکتبر ۲۰۲۶)](https://arxiv.org/abs/2610.32318)
- ["The Embedder's Dilemma" (arXiv 2608.12875، آگوست ۲۰۲۶)](https://arxiv.org/abs/2608.12875)
- Sun et al. "Is ChatGPT Good at Search? Investigating Large Language Models as Re-Ranking Agents" (2023)

---

*قبلی: [جستجوی ترکیبی](05-hybrid-search.md) | بعدی: [GraphRAG](07-graph-rag.md)*

</div>
