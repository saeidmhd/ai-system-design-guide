<div dir="rtl">

# جستجوی ترکیبی (Hybrid Search)

جستجوی ترکیبی (Hybrid Search) بازیابی متراکم (dense / معنایی) و تنک (sparse / کلیدواژه‌ای) را با یکدیگر ترکیب می‌کند تا از مزایای هر دو بهره‌مند شود. این رویکرد، خط مبنا (baseline) برای RAG در محیط عملیاتی است: بازیاب‌های `rrf` و `linear` در Elasticsearch، جستجوی ترکیبی در OpenSearch، و Weaviate، Qdrant، Milvus و Azure AI Search همگی خطوط لوله ترکیبی نیتیو را به‌صورت پیش‌فرض ارائه می‌دهند. پایگاه داده Pinecone نیز جستجوی تمام‌متن BM25 را اضافه کرد (عرضه عمومی در ۹ سپتامبر ۲۰۲۶)، اما هر درخواست بر اساس یک نوع امتیازدهی رتبه‌بندی می‌شود؛ بنابراین باید نتایج واژگانی و برداری را در سمت کلاینت ادغام (fuse) کنید.

## فهرست مطالب

- [چرا جستجوی ترکیبی](#why-hybrid-search)
- [بازیابی متراکم در برابر بازیابی تنک](#dense-vs-sparse-retrieval)
- [معماری‌های جستجوی ترکیبی](#hybrid-search-architectures)
- [روش‌های ادغام](#fusion-methods)
- [امبدینگ‌های تنک یادگرفته‌شده (SPLADE)](#learned-sparse-embeddings-splade)
- [الگوهای پیاده‌سازی](#implementation-patterns)
- [تنظیم و بهینه‌سازی](#tuning-and-optimization)
- [ملاحظات محیط عملیاتی](#production-considerations)
- [سوالات مصاحبه](#interview-questions)
- [منابع](#references)

---

<a id="why-hybrid-search"></a>

## چرا جستجوی ترکیبی

هیچ‌یک از روش‌های بازیابی متراکم یا تنک برتری مطلق ندارند. هر کدام در انواع خاصی از پرس‌وجوها عالی عمل می‌کنند.

### تحلیل نوع پرس‌وجو

| نوع پرس‌وجو | مثال | بازیابی بهتر |
|------------|---------|------------------|
| مفهومی | "How do transformers learn?" | متراکم (Dense) |
| وابسته به کلیدواژه | "GPT-4 API rate limits" | تنک (Sparse) |
| موجودیت‌های نام‌دار | "John Smith's research on BERT" | تنک (Sparse) |
| کوته‌نوشت‌ها/کدها | "What does HTTP 429 mean?" | تنک (Sparse) |
| بازنویسی‌شده | "How to make AI faster" در برابر "LLM optimization" | متراکم (Dense) |
| ترکیبی | "What is the cost of GPT-4o API?" | ترکیبی (Hybrid) |

**نکته ظریف**: بازیابی صرفاً متراکم در مستندات فنی، جایی که شماره نسخه‌های خاص و نام توابع ۹۰٪ از ارزش اطلاعاتی را تشکیل می‌دهند، شکست می‌خورد.

### مسئله شکاف اطلاعاتی

بازیابی متراکم ممکن است تطابق‌های دقیق را از دست بدهد:

<div dir="ltr">

```
Query: "Configure NVIDIA_VISIBLE_DEVICES"
Document: "Set the NVIDIA_VISIBLE_DEVICES environment variable..."

Dense search may miss this because:
- "NVIDIA_VISIBLE_DEVICES" might tokenize poorly
- Semantic embedding does not capture exact string matching
- Training data may not have this specific term
```

</div>

جستجوی تنک (BM25) به دلیل تطابق دقیق Token، این مورد را بلافاصله پیدا می‌کند.

---

<a id="dense-vs-sparse-retrieval"></a>

## بازیابی متراکم در برابر بازیابی تنک

### بازیابی متراکم (معنایی)

از امبدینگ‌های عصبی برای تطبیق معنایی استفاده می‌کند.

<div dir="ltr">

```python
def dense_search(query: str, top_k: int = 10) -> list[Result]:
    query_embedding = embedding_model.encode(query)
    results = vector_db.search(query_embedding, top_k=top_k)
    return results
```

</div>

**نقاط قوت:**
- درک بازنویسی‌ها و کلمات مترادف
- ثبت شباهت مفهومی
- عملکرد در میان زبان‌های مختلف (با مدل‌های چندزبانه)

**نقاط ضعف:**
- احتمال از دست دادن تطابق دقیق کلیدواژه‌ها
- دشواری در مواجهه با موجودیت‌ها، کدها و کوته‌نوشت‌ها
- نیاز به مدل امبدینگ

### بازیابی تنک (کلیدواژه‌ای)

از بسامد عبارات و محاسبات آماری (BM25 و TF-IDF) استفاده می‌کند.

<div dir="ltr">

```python
def sparse_search(query: str, top_k: int = 10) -> list[Result]:
    tokens = tokenize(query)
    results = bm25_index.search(tokens, top_k=top_k)
    return results
```

</div>

**نقاط قوت:**
- عملکرد عالی برای تطابق‌های دقیق
- مدیریت اصطلاحات نادر، کدها و موجودیت‌ها
- سریع و قابل تفسیر
- عدم نیاز به آموزش

**نقاط ضعف:**
- از دست دادن شباهت معنایی
- عدم درک کلمات مترادف
- حساسیت به عدم تطابق واژگان

### مقایسه رو در رو

| جنبه | متراکم | تنک | ترکیبی |
|--------|-------|--------|--------|
| تطبیق معنایی | بهترین | ضعیف | بهترین |
| تطبیق دقیق | ضعیف | بهترین | بهترین |
| اصطلاحات نادر | ضعیف | بهترین | بسیار خوب |
| دامنه‌های صفر-نمونه | بسیار خوب | بهترین | بهترین |
| تاخیر (Latency) | متوسط | سریع | متوسط |
| پیاده‌سازی | متوسط | ساده | پیچیده |

---

<a id="hybrid-search-architectures"></a>

## معماری‌های جستجوی ترکیبی

### معماری ۱: بازیابی موازی همراه با ادغام

<div dir="ltr">

```
                    +------------------+
                    |      Query       |
                    +--------+---------+
                             |
              +--------------+--------------+
              v                             v
    +-------------------+         +-------------------+
    |  Dense Retrieval  |         |  Sparse Retrieval |
    |   (Vector DB)     |         |    (BM25/ES)      |
    +---------+---------+         +---------+---------+
              |                             |
              +--------------+--------------+
                             v
                    +-------------------+
                    |      Fusion       |
                    |  (RRF, weighted)  |
                    +---------+---------+
                              |
                              v
                    +-------------------+
                    |  Final Results    |
                    +-------------------+
```

</div>

**مزایا:** تفکیک شفاف، امکان استفاده از بهترین ابزار در هر رده (مانند Pinecone + Algolia)، و تنظیم مستقل هر بخش
**معایب:** نگهداری از دو سیستم مجزا، تاخیر (Latency) بالاتر (باید منتظر موتور کندتر ماند)

### معماری ۲: ترکیبی نیتیو (سیستم واحد)

برخی از پایگاه‌های داده برداری (Vector Database) به‌صورت نیتیو از جستجوی ترکیبی پشتیبانی می‌کنند:

<div dir="ltr">

```python
# Weaviate (Python client v4)
docs = client.collections.use("Document")
results = docs.query.hybrid(
    query="Configure NVIDIA_VISIBLE_DEVICES",
    alpha=0.5,  # 0 = sparse only, 1 = dense only
)

# Qdrant (Query API: prefetch both arms, fuse server-side)
from qdrant_client import models

results = client.query_points(
    collection_name="docs",
    prefetch=[
        models.Prefetch(query=dense_embedding, using="dense", limit=40),
        models.Prefetch(
            query=models.SparseVector(indices=sparse_indices, values=sparse_values),
            using="sparse",
            limit=40,
        ),
    ],
    query=models.FusionQuery(fusion=models.Fusion.RRF),
    limit=10,
).points
```

</div>

**مزایا:** سیستم واحد، عملیات نگهداری ساده‌تر، تاخیر (Latency) کمتر
**معایب:** سفارشی‌سازی محدود در ادغام، انعطاف‌پذیری کمتر در مقیاس‌پذیری زیرساخت کلیدواژه‌ای در برابر برداری

### معماری ۳: بازیابی چندمرحله‌ای

<div dir="ltr">

```
Query --> Sparse (fast, broad) --> Top 1000
                    |
                    v
          Dense reranking --> Top 100
                    |
                    v
           Cross-encoder --> Top 10
```

</div>

**مزایا:** کارآمد، هر مرحله نتایج را پالایش می‌کند
**معایب:** پیچیدگی بیشتر، خطر بروز خطا در مراحل اولیه

---

<a id="fusion-methods"></a>

## روش‌های ادغام

### ادغام رتبه متقابل (RRF)

روش RRF استاندارد طلایی برای ترکیب نتایج حاصل از دو موتور جستجوی متفاوت است. این روش به *امتیاز* (که در میان موتورهای مختلف غیرقابل مقایسه است) نگاه نمی‌کند، بلکه **رتبه** را در نظر می‌گیرد.

<div dir="ltr">

```python
def reciprocal_rank_fusion(
    rankings: list[list[str]],  # List of doc_id lists
    k: int = 60
) -> list[tuple[str, float]]:
    scores = defaultdict(float)

    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] += 1 / (k + rank + 1)

    sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_docs
```

</div>

**ویژگی‌ها:**
- مبتنی بر موقعیت، امتیازهای خام را نادیده می‌گیرد
- مقاوم در برابر تفاوت مقیاس امتیازها: از «غالب شدن» یک موتور صرفاً به دلیل داشتن امتیازهای عددی بالا جلوگیری می‌کند
- پارامتر k حساسیت رتبه را کنترل می‌کند (k بزرگ‌تر = حساسیت کمتر به موقعیت)
- پیاده‌سازی ساده، بدون نیاز به تنظیم پارامتری فراتر از k

**مقادیر متداول k:** ۶۰ (در مقاله اصلی)، ۱۰ تا ۱۰۰ در عمل

### ادغام امتیاز وزنی

ترکیب امتیازهای نرمال‌شده:

<div dir="ltr">

```python
def weighted_fusion(
    dense_results: list[Result],
    sparse_results: list[Result],
    alpha: float = 0.5  # Weight for dense
) -> list[Result]:
    # Normalize scores to [0, 1]
    dense_normalized = normalize_scores(dense_results)
    sparse_normalized = normalize_scores(sparse_results)

    # Combine
    combined = {}
    for r in dense_normalized:
        combined[r.id] = alpha * r.score
    for r in sparse_normalized:
        combined[r.id] = combined.get(r.id, 0) + (1 - alpha) * r.score

    sorted_docs = sorted(combined.items(), key=lambda x: x[1], reverse=True)
    return sorted_docs

def normalize_scores(results: list[Result]) -> list[Result]:
    if not results:
        return []
    min_score = min(r.score for r in results)
    max_score = max(r.score for r in results)
    range_score = max_score - min_score + 1e-6

    return [
        Result(id=r.id, score=(r.score - min_score) / range_score)
        for r in results
    ]
```

</div>

**ویژگی‌ها:**
- استفاده از امتیازهای واقعی (اطلاعات بیشتر نسبت به رتبه)
- نیاز به نرمال‌سازی امتیازها دارد
- پارامتر Alpha تعادل بین متراکم و تنک را کنترل می‌کند

### ادغام امتیاز نسبی

لحاظ کردن توزیع امتیازها:

<div dir="ltr">

```python
def relative_score_fusion(
    dense_results: list[Result],
    sparse_results: list[Result]
) -> list[Result]:
    # Use z-score normalization
    dense_normalized = z_score_normalize(dense_results)
    sparse_normalized = z_score_normalize(sparse_results)

    # Combine
    combined = {}
    for r in dense_normalized:
        combined[r.id] = r.score
    for r in sparse_normalized:
        combined[r.id] = combined.get(r.id, 0) + r.score

    return sorted(combined.items(), key=lambda x: x[1], reverse=True)

def z_score_normalize(results: list[Result]) -> list[Result]:
    scores = [r.score for r in results]
    mean = sum(scores) / len(scores)
    std = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5 + 1e-6

    return [Result(id=r.id, score=(r.score - mean) / std) for r in results]
```

</div>

### مقایسه روش‌های ادغام

| روش | استفاده از امتیازها | انطباق‌پذیر با پرس‌وجو | پیچیدگی |
|--------|-------------|----------------|------------|
| RRF | خیر (صرفاً رتبه‌ها) | خیر | کم |
| Weighted RRF | خیر (رتبه‌ها، وزن به ازای هر شاخه) | خیر | کم |
| Weighted | بله | خیر | کم |
| Relative Score | بله | تا حدی | متوسط |
| Learned | بله | بله | بالا |

**موقعیت موتورهای مختلف:** موتور Elasticsearch با بازیاب `rrf` یا بازیاب مبتنی بر امتیاز `linear` ادغام را انجام می‌دهد. پایگاه داده Weaviate به‌صورت پیش‌فرض از ادغام امتیاز نسبی استفاده می‌کند. پایگاه داده Qdrant روش‌های RRF و ادغام امتیاز مبتنی بر توزیع را در Query API ارائه می‌دهد. پایگاه داده Milvus 3.0.1 روش RRF وزنی را اضافه کرد که استقلال مقیاس در RRF را حفظ می‌کند و در عین حال به شما امکان می‌دهد یکی از شاخه‌ها را ترجیح دهید.

---

<a id="learned-sparse-embeddings-splade"></a>

## امبدینگ‌های تنک یادگرفته‌شده (SPLADE)

مجموعه‌های نرم‌افزاری عملیاتی برای شاخه تنک جستجوی ترکیبی، فراتر از BM25 (بسامد ساده کلمات) رفته و به سمت **امبدینگ‌های تنک یادگرفته‌شده (Learned Sparse Embeddings)** حرکت کرده‌اند.

**تکنیک**: مدل‌هایی مانند **SPLADE v3** «وزن‌های اهمیت» را برای هر کلمه در فرهنگ لغت پیش‌بینی می‌کنند.

**چرا؟**: مدل SPLADE می‌تواند پرس‌وجوها را «گسترش» دهد. اگر عبارت "CPU" را جستجو کنید، ممکن است به‌طور خودکار وزن کمی به واژه "processor" اختصاص دهد، حتی اگر "processor" در پرس‌وجوی شما نباشد. این رویکرد قدرت تطابق دقیق جستجوی تنک را با توانایی مفهومی جستجوی متراکم در یک فرمت ذخیره‌سازی واحد ادغام می‌کند.

### پیاده‌سازی SPLADE

<div dir="ltr">

```python
from sentence_transformers import SparseEncoder  # sentence-transformers >= 5.0

class SpladeEncoder:
    def __init__(self, model_name="naver/splade-v3"):
        self.model = SparseEncoder(model_name)

    def encode_query(self, text: str) -> dict[str, float]:
        emb = self.model.encode_query([text])
        return dict(self.model.decode(emb)[0])

    def encode_document(self, text: str) -> dict[str, float]:
        emb = self.model.encode_document([text])
        return dict(self.model.decode(emb)[0])
```

</div>

مدل naver/splade-v3 دارای دسترسی کنترل‌شده (gated) است و تحت مجوز CC BY-NC-SA 4.0 (غیرتجاری) عرضه شده است، همانند چک‌پوینت قدیمی‌تر SPLADE++؛ بنابراین پیش از استقرار (Deployment) در محیط عملیاتی، مجوز آن را بررسی کنید یا مدلی تنک و یادگرفته‌شده با مجوز تجاری را برگزینید.

**چه زمانی از SPLADE به جای ترکیب BM25 و متراکم (BM25 + Dense Hybrid) استفاده کنیم:** مدل SPLADE یک بردار تنک تولید می‌کند که می‌تواند در پایگاه‌های داده برداری (Vector Database) مدرن (مانند Milvus یا Qdrant) در کنار بردار متراکم ذخیره شود، و جستجوی ترکیبی را در یک گام واحد بدون نیاز به یک نمایه مجزای Elasticsearch یا BM25 ممکن سازد. اگر مجموعه داده شما حاوی Tokenهای بسیار نادر و غیرزبانی است (مانند شماره سریال‌های یکتا) که ممکن است یک مدل عصبی در طول آموزش ندیده باشد، همچنان از BM25 استفاده کنید.

**نمایه‌های تنک خود را ارتقا داده‌اند.** بردارهای تنک یادگرفته‌شده نسبت به BM25 اصطلاحات غیرصفر بسیار بیشتری به ازای هر سند دارند، که پیش‌تر باعث کندی آن‌ها روی نمایه‌های معکوسِ طراحی‌شده برای جستجوی کلیدواژه‌ای می‌شد. پایگاه داده Milvus 3.0 نمایه تنک خود را حول محور SINDI، الگوریتم Block-Max WAND و Block-Max MaxScore بازطراحی کرد؛ طبق گزارش Milvus، حجم نمایه فشرده BM25 به حدود یک‌سوم نسخه 2.6 رسیده و کارایی SINDI روی بردارهای تنک یادگرفته‌شده تا حدود ۱۰ برابر QPS بالاتر از MaxScore است (بنچمارک‌های ارائه‌دهنده).

---

<a id="implementation-patterns"></a>

## الگوهای پیاده‌سازی

### الگوی ۱: ترکیب Elasticsearch و پایگاه داده برداری (Vector Database)

<div dir="ltr">

```python
import asyncio

class HybridSearcher:
    def __init__(self, es_client, vector_db, embedding_model):
        self.es = es_client
        self.vector_db = vector_db
        self.embedding_model = embedding_model

    async def search(self, query: str, top_k: int = 10) -> list[Result]:
        # Parallel retrieval
        dense_results, sparse_results = await asyncio.gather(
            self.dense_search(query, top_k * 3),
            self.sparse_search(query, top_k * 3),
        )

        # Fusion
        combined = reciprocal_rank_fusion([
            [r.id for r in dense_results],
            [r.id for r in sparse_results]
        ])

        return combined[:top_k]

    async def dense_search(self, query: str, top_k: int) -> list[Result]:
        embedding = self.embedding_model.encode(query)
        return await self.vector_db.search(embedding, top_k=top_k)

    async def sparse_search(self, query: str, top_k: int) -> list[Result]:
        # es_client is an AsyncElasticsearch instance
        response = await self.es.search(
            index="documents",
            query={"match": {"content": query}},
            size=top_k,
        )
        return [
            Result(id=hit["_id"], score=hit["_score"])
            for hit in response["hits"]["hits"]
        ]
```

</div>

### الگوی ۲: جستجوی ترکیبی نیتیو با Weaviate

<div dir="ltr">

```python
import weaviate
from weaviate.classes.query import HybridFusion

def hybrid_search_weaviate(
    client: weaviate.WeaviateClient,
    query: str,
    alpha: float = 0.5,
    top_k: int = 10
) -> list[dict]:
    docs = client.collections.use("Document")
    response = docs.query.hybrid(
        query=query,
        alpha=alpha,  # 0 = BM25 only, 1 = vector only
        fusion_type=HybridFusion.RELATIVE_SCORE,
        limit=top_k,
    )

    return [obj.properties for obj in response.objects]
```

</div>

---

<a id="tuning-and-optimization"></a>

## تنظیم و بهینه‌سازی

### تنظیم Alpha

پارامتر alpha تعادل بین متراکم و تنک را برقرار می‌کند:

<div dir="ltr">

```python
def find_optimal_alpha(
    test_queries: list[tuple[str, list[str]]],  # (query, relevant_doc_ids)
    alpha_range: list[float] = [0.0, 0.3, 0.5, 0.7, 1.0]
) -> float:
    best_alpha = 0.5
    best_ndcg = 0

    for alpha in alpha_range:
        ndcg_scores = []
        for query, relevant in test_queries:
            results = hybrid_search(query, alpha=alpha)
            ndcg = compute_ndcg(results, relevant)
            ndcg_scores.append(ndcg)

        avg_ndcg = sum(ndcg_scores) / len(ndcg_scores)
        if avg_ndcg > best_ndcg:
            best_ndcg = avg_ndcg
            best_alpha = alpha

    return best_alpha
```

</div>

**بهترین تجارب / یافته‌های متداول:**
- مستندات فنی و کد: مقدار alpha بین ۰.۳ تا ۰.۴ (تمرکز بالا بر کلیدواژه)
- متون عمومی: مقدار alpha برابر با ۰.۵ (متعادل)
- گفتگو و کاوش‌های خلاقانه: مقدار alpha بین ۰.۷ تا ۰.۹ (تمرکز بالا بر معنا)

### تنظیم Alpha منطبق با پرس‌وجو

پیش‌بینی مقدار بهینه alpha به ازای هر پرس‌وجو:

<div dir="ltr">

```python
def predict_alpha(query: str) -> float:
    # Heuristics-based
    has_quotes = '"' in query
    has_code = any(c in query for c in ['_', '()', '{}', '[]'])
    has_numbers = any(c.isdigit() for c in query)

    # More sparse for exact match queries
    if has_quotes or has_code:
        return 0.3
    if has_numbers:
        return 0.4

    # More semantic for natural language
    if len(query.split()) > 5:
        return 0.7

    return 0.5  # Default balanced
```

</div>

### تنوع و قواعد کسب‌وکار

ادغام نتایج، ارتباط موضوعی را به ازای هر سند بهینه‌سازی می‌کند، بنابراین تکه‌های متنی (chunks) تقریباً تکراری از یک منبع مشترک می‌توانند نتایج top-k را پر کنند. دو مکانیزم کنترلی که پیش‌تر در کد برنامه پیاده‌سازی می‌شدند، اکنون در Weaviate 1.39 (آگوست ۲۰۲۶) به ویژگی‌های عمومی موتور تبدیل شده‌اند:
- **معیار MMR (ارتباط حاشیه‌ای حداکثر / maximal marginal relevance)** برای جستجوی ترکیبی و برداری، با یک پارامتر تعادل بین 0.0 و 1.0 که میان ارتباط موضوعی و تنوع تعادل ایجاد می‌کند (کلاینت پایتون نسخه 4.23.0 به بالا برای جستجوی ترکیبی).
- **قابلیت Boost API**: امتیازدهی مجدد در زمان پرس‌وجو که نتایج را بر اساس تطابق فیلتر، مقدار ویژگی، زوال زمانی یا زوال عددی ارتقا یا تنزل می‌دهد، بدون آنکه موردی را کاملاً حذف کند. از این قابلیت برای تازگی محتوا و قواعدی مانند «ترجیح مستندات رسمی» استفاده کنید تا نیازی به فیلترهای قطعی که می‌توانند مجموعه نتایج را خالی کنند نباشد.

### عمق بازیابی

تعداد نتایجی که باید پیش از ادغام واکشی شوند:

<div dir="ltr">

```python
# Rule of thumb: fetch 3-5x more from each source
def hybrid_search(query: str, final_k: int = 10):
    fetch_k = final_k * 4

    dense_results = dense_search(query, top_k=fetch_k)
    sparse_results = sparse_search(query, top_k=fetch_k)

    fused = rrf([dense_results, sparse_results])
    return fused[:final_k]
```

</div>

---

<a id="production-considerations"></a>

## ملاحظات محیط عملیاتی

### بودجه تاخیر (Latency)

<div dir="ltr">

```
Typical hybrid search latency breakdown:

Dense embedding:           30-50ms
Dense retrieval:          30-50ms
Sparse retrieval:         20-40ms  (parallel with dense)
Fusion:                    1-5ms
Total:                   60-100ms
```

</div>

**بهینه‌سازی‌ها:**
- اجرای موازی جستجوی متراکم و تنک
- پیش‌محاسبه امبدینگ‌ها برای پرس‌وجوهای متداول
- استفاده از جستجوی تقریبی برای هر دو روش
- کش کردن نتایج ادغام برای پرس‌وجوهای تکراری

### امتیازدهی کلیدواژه‌ای چندمستأجری (multi-tenant)

الگوریتم BM25 به آمارهای پیکره متنی (IDF) وابسته است. در یک کالکشن چندمستأجری (multi-tenant) اشتراکی، دایره واژگان یک مستأجر (tenant / multi-tenant) بزرگ می‌تواند امتیازهای کلیدواژه‌ای سایر مستأجرها (tenant / multi-tenant) را تغییر دهد؛ بنابراین یک پرس‌وجو و اسناد یکسان بسته به اینکه چه داده‌های دیگری در نمایه حضور دارند رتبه‌بندی متفاوتی خواهند داشت و آمار اصطلاحات میان مستأجرها (tenant / multi-tenant) نشت می‌کند. نسخه Qdrant 1.19 قابلیت IDF به ازای هر مستأجر (tenant / multi-tenant) را برای جستجوی تنک و BM25 اضافه کرده است؛ در سایر سیستم‌ها، به مستأجرهای (tenant / multi-tenant) بزرگ نمایه اختصاصی خودشان را بدهید یا این انحراف آماری را بپذیرید و ارزیابی را به تفکیک هر مستأجر (tenant / multi-tenant) انجام دهید.

### استراتژی کشینگ

<div dir="ltr">

```python
class HybridSearchCache:
    def __init__(self, ttl_seconds: int = 300):
        self.cache = TTLCache(ttl=ttl_seconds)

    def search(self, query: str, **kwargs) -> list[Result]:
        cache_key = self._make_key(query, kwargs)

        if cache_key in self.cache:
            return self.cache[cache_key]

        results = self._do_search(query, **kwargs)
        self.cache[cache_key] = results
        return results

    def _make_key(self, query: str, kwargs: dict) -> str:
        return hashlib.sha256(
            f"{query}:{sorted(kwargs.items())}".encode()
        ).hexdigest()
```

</div>

### استراتژی پشتیبان (Fallback)

<div dir="ltr">

```python
def hybrid_search_with_fallback(query: str, top_k: int = 10) -> list[Result]:
    try:
        return hybrid_search(query, top_k=top_k)
    except DenseSearchError:
        # Fallback to sparse only
        return sparse_search(query, top_k=top_k)
    except SparseSearchError:
        # Fallback to dense only
        return dense_search(query, top_k=top_k)
```

</div>

---

<a id="interview-questions"></a>

## سوالات مصاحبه

### سوال: چه زمانی از جستجوی ترکیبی به جای جستجوی صرفاً متراکم استفاده می‌کنید؟

**پاسخ قوی:**
من در موارد زیر از جستجوی ترکیبی استفاده می‌کنم:

۱. **پرس‌وجوها حاوی اصطلاحات خاص باشند:** کدهای محصول، نام‌های API، کدهای خطا. جستجوی متراکم ممکن است تطابق‌های دقیق را از دست بدهد.

۲. **دامنه دارای واژگان تخصصی باشد:** مستندات فنی، حقوقی، پزشکی. جستجوی تنک اصطلاحات خاص را به خوبی دریافت می‌کند.

۳. **بازیابی صفر-نمونه (Zero-shot):** دامنه جدید بدون امبدینگ‌هایی که تحت Fine-tuning قرار گرفته باشند. جستجوی تنک یک خط مبنای قدرتمند فراهم می‌کند.

۴. **کیفیت حیاتی باشد:** جستجوی ترکیبی به ندرت عملکردی ضعیف‌تر از هر یک از روش‌ها به تنهایی دارد، البته به قیمت پیچیدگی بیشتر.

**در موارد زیر از جستجوی صرفاً متراکم استفاده می‌کنم:**
- پرس‌وجوها کاملاً مفهومی/معنایی باشند
- بودجه تاخیر (Latency) بسیار محدود باشد
- اولویت با معماری ساده‌تر باشد
- مدل امبدینگ برای دامنه مورد نظر به خوبی تنظیم شده باشد

این تصمیم تجربی است. من جستجوی ترکیبی را در برابر متراکم با آزمون A/B روی توزیع واقعی پرس‌وجوهایم می‌سنجم.

### سوال: چرا روش ادغام رتبه متقابل (RRF) نسبت به «جمع ساده امتیازها» ایمن‌تر است؟

**پاسخ قوی:**
جمع ساده امتیازها خطرناک است زیرا امتیازهای برداری و کلیدواژه‌ای از مقیاس‌های کاملاً متفاوتی استفاده می‌کنند. شباهت کسینوسی به بازه ۱- تا ۱ محدود است و بسیاری از مدل‌های امبدینگ متنی آن را به یک محدوده مثبت باریک فشرده می‌کنند؛ در مقابل، امتیاز BM25 نامحدود است و با آمار پیکره متنی و طول پرس‌وجو نوسان می‌کند. یک امتیاز بسیار بالای BM25 برای یک تطابق کلیدواژه‌ای تصادفی می‌تواند ۱۰ تطابق معنایی بسیار مرتبط را «محو» کند. روش RRF امتیازهای مطلق را نادیده می‌گیرد و صرفاً به ترتیب نسبی (رتبه) اهمیت می‌دهد. این موضوع آن را در برابر داده‌های پرت و انحراف امتیاز میان موتورهای بازیابی مختلف مصون می‌سازد.

### سوال: چه زمانی SPLADE را به رویکرد استاندارد ترکیب BM25 و متراکم (BM25 + Dense Hybrid) ترجیح می‌دهید؟

**پاسخ قوی:**
زمانی SPLADE را انتخاب می‌کنم که بخواهم زیرساختم را ساده‌تر کنم. مدل SPLADE یک بردار تنک تولید می‌کند که می‌تواند در بسیاری از پایگاه‌های داده برداری (Vector Database) مدرن (مانند Milvus یا Qdrant) در کنار بردار متراکم ذخیره شود. این قابلیت به پایگاه داده امکان می‌دهد «جستجوی ترکیبی» را در یک گام واحد بدون نیاز به یک نمایه مجزای Elasticsearch یا BM25 انجام دهد. با این حال، اگر مجموعه داده من حاوی Tokenهای بسیار نادر و غیرزبانی باشد (مانند شماره سریال‌های منحصربه‌فرد) که ممکن است یک مدل عصبی در طول آموزش ندیده باشد، همچنان از BM25 استفاده خواهم کرد.

### سوال: چگونه تعادل بین بازیابی متراکم و تنک را در جستجوی ترکیبی برقرار می‌کنید؟

**پاسخ قوی:**
پارامتر alpha این تعادل را کنترل می‌کند (معمولاً alpha وزن بخش متراکم است):

**رویکرد تنظیم:**
۱. شروع با alpha=0.5 (وزن برابر)
۲. ایجاد مجموعه ارزیابی با پرس‌وجوها و برچسب‌های ارتباط موضوعی
۳. جستجوی شبکه‌ای (Grid search) برای alpha در [0.1, 0.3, 0.5, 0.7, 0.9]
۴. اندازه‌گیری NDCG یا MRR در هر تنظیم
۵. انتخاب مقداری از alpha که معیار ارزیابی را بیشینه کند

**تنظیم منطبق با پرس‌وجو:**
- تشخیص نوع پرس‌وجو (مبتنی بر کلیدواژه، مفهومی، ترکیبی)
- تنظیم alpha به ازای هر پرس‌وجو
- امکان استفاده از روش‌های ابتکاری ساده یا یک دسته‌بند یادگرفته‌شده

**قاعده سرانگشتی:**
- پرس‌وجوهای فنی/کد: alpha بین ۰.۳ تا ۰.۴
- متون عمومی: alpha برابر با ۰.۵
- مکالمه‌ای: alpha بین ۰.۷ تا ۰.۸

---

<a id="references"></a>

## منابع

- کورماک و همکاران، "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods" (۲۰۰۹)
- فورمال و همکاران، "SPLADE: Sparse Lexical and Expansion Model for First Stage Ranking" (۲۰۲۱/۲۰۲۵)
- جستجوی ترکیبی Weaviate: https://weaviate.io/developers/weaviate/search/hybrid
- جستجوی ترکیبی Qdrant: https://qdrant.tech/documentation/concepts/hybrid-queries/
- [یادداشت‌های انتشار Elasticsearch (نسخه ۹.۵)](https://www.elastic.co/docs/release-notes/elasticsearch)
- [عرضه عمومی جستجوی تمام‌متن Pinecone (سپتامبر ۲۰۲۶)](https://www.pinecone.io/blog/full-text-search-generally-available/)
- [یادداشت‌های انتشار Milvus 3.0.0 (ژوئیه ۲۰۲۶)](https://github.com/milvus-io/milvus/releases/tag/v3.0.0)

---

*قبلی: [پایگاه‌های داده برداری](04-vector-databases.md) | بعدی: [استراتژی‌های رتبه‌بندی مجدد](06-reranking-strategies.md)*

</div>
