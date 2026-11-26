<div dir="rtl">

# تعامل دیرهنگام (Late Interaction) و ColBERT

تعامل دیرهنگام (Late Interaction) یک پارادایم بازیابی است که میان **bi-encoderها**ی سریع اما نادقیق و **cross-encoderها**ی دقیق اما کُند قرار می‌گیرد. مدل ColBERT (کوتاه‌شده‌ی Contextualized Late Interaction over BERT) مدل شاخص و تعیین‌کننده در این حوزه است که دقت در سطح cross-encoder را با سرعتی در سطح bi-encoder ارائه می‌دهد. خانواده‌ی تعامل دیرهنگام به یک گزینه‌ی جایگزین و آماده‌ی محیط عملیاتی برای جستجوی با دقت بالا تکامل یافته است و اکنون افزونه‌های چندحالته (ColPali، ColQwen2.5، ColNomic و بازیاب‌های یکپارچه مانند Wholembed v3) را نیز در جعبه‌ابزار خود دارد.

## فهرست مطالب

- [طیف معماری‌های بازیابی](#the-retrieval-architecture-spectrum)
- [معماری ColBERT](#colbert-architecture)
- [MaxSim: سازوکار اصلی امتیازدهی](#maxsim-the-core-scoring-mechanism)
- [نمایه‌سازی ColBERTv2 و PLAID](#colbertv2-and-plaid-indexing)
- [چندبرداری در پایگاه‌های داده برداری (Vector Database) چندمنظوره (MUVERA)](#multi-vector-in-general-purpose-vector-dbs-muvera)
- [تعامل دیرهنگام در مقایسه با گزینه‌های جایگزین](#late-interaction-vs-alternatives)
- [پیاده‌سازی با RAGatouille](#implementation-with-ragatouille)
- [الگوهای استقرار (Deployment) در محیط عملیاتی](#production-deployment-patterns)
- [چه زمانی ColBERT را انتخاب کنیم](#when-to-choose-colbert)
- [سوالات مصاحبه](#interview-questions)
- [منابع](#references)

---

<a id="the-retrieval-architecture-spectrum"></a>

## طیف معماری‌های بازیابی

سه معماری بنیادین برای بازیابی عصبی وجود دارد. درک جایگاه تعامل دیرهنگام، کلید فهم کل این فصل است.

<div dir="ltr">

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   SPEED ◄──────────────────────────────────────────────► ACCURACY   │
│                                                                     │
│   Bi-Encoder          Late Interaction          Cross-Encoder       │
│   (Single Vector)     (Multi-Vector)            (Full Attention)    │
│                                                                     │
│   ● Fast (< 10ms)     ● Balanced (10-50ms)      ● Slow (100ms+)   │
│   ● Low accuracy       ● High accuracy           ● Highest accuracy│
│   ● Scales to 1B+     ● Scales to 100M+         ● Scales to 10K   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

</div>

### نحوه‌ی پردازش یک جفت پرس‌وجو-سند توسط هر معماری

<div dir="ltr">

```
BI-ENCODER (e.g., E5, BGE):
  Query  ──► Encoder ──► [1 vector]  ─┐
                                      ├──► dot product ──► score
  Doc    ──► Encoder ──► [1 vector]  ─┘

  Total interaction: 1 comparison

─────────────────────────────────────────────

LATE INTERACTION (ColBERT):
  Query  ──► Encoder ──► [N vectors] ─┐
                (one per token)       ├──► MaxSim ──► score
  Doc    ──► Encoder ──► [M vectors] ─┘
                (one per token)

  Total interaction: N x M comparisons (but decomposable)

─────────────────────────────────────────────

CROSS-ENCODER (e.g., ms-marco-MiniLM):
  [Query + Doc] ──► Encoder ──► score

  Total interaction: Full self-attention across
                     all query AND document tokens
```

</div>

**نکته کلیدی**: تفاوت حیاتی در این است که پرس‌وجو و سند *چه زمانی* با یکدیگر تعامل برقرار می‌کنند. مدل‌های Bi-encoder هرگز تعامل برقرار نمی‌کنند (کدگذاری مستقل). مدل‌های Cross-encoder به‌طور کامل تعامل دارند (کدگذاری مشترک). تعامل دیرهنگام راه‌حل میانه است: کدگذاری به‌صورت مستقل انجام می‌شود و سپس تعامل کم‌هزینه در سطح Token صورت می‌گیرد.

---

<a id="colbert-architecture"></a>

## معماری ColBERT

مدل ColBERT پرس‌وجوها و اسناد را به **ماتریس‌هایی از امبدینگ‌های در سطح Token** (و نه بردارهای تکی) کدگذاری می‌کند و با استفاده از تعاملات ریزدانه‌ی بین Tokenها به آن‌ها امتیاز می‌دهد.

### فاز کدگذاری

<div dir="ltr">

```
Query: "What is the price of Widget-X?"

Token Embeddings (each 128-dim):
  q1 = Embed("What")     = [0.12, -0.34, ..., 0.08]
  q2 = Embed("is")       = [0.05, -0.11, ..., 0.22]
  q3 = Embed("the")      = [0.01, -0.02, ..., 0.15]
  q4 = Embed("price")    = [0.45,  0.67, ..., 0.91]  ◄── high signal
  q5 = Embed("of")       = [0.03, -0.05, ..., 0.11]
  q6 = Embed("Widget-X") = [0.88,  0.21, ..., 0.73]  ◄── high signal

Document: "Widget-X costs $200 per month for the Standard plan"

Token Embeddings:
  d1 = Embed("Widget-X")  = [0.85,  0.19, ..., 0.71]
  d2 = Embed("costs")     = [0.42,  0.63, ..., 0.88]
  d3 = Embed("$200")      = [0.31,  0.55, ..., 0.79]
  d4 = Embed("per")       = [0.02, -0.01, ..., 0.09]
  d5 = Embed("month")     = [0.11,  0.08, ..., 0.14]
  d6 = Embed("Standard")  = [0.38,  0.44, ..., 0.62]
  d7 = Embed("plan")      = [0.29,  0.37, ..., 0.51]
```

</div>

**انتخاب کلیدی در طراحی**: مدل ColBERT از امبدینگ‌های Token **۱۲۸ بعدی** (در مقایسه با ۷۶۸ تا ۱۰۲۴ بعد در bi-encoderهای استاندارد) استفاده می‌کند. این بعد کوچک‌تر برای کارایی ذخیره‌سازی حیاتی است؛ زیرا به جای ۱ بردار به ازای هر سند، N بردار ذخیره می‌کنیم.

### محاسبات آفلاین در مقابل آنلاین

| مؤلفه | زمان انجام | هزینه |
|-------|------------|-------|
| کدگذاری اسناد | آفلاین (نمایه‌سازی) | یک‌باره، قابل موازی‌سازی |
| کدگذاری پرس‌وجو | آنلاین (به ازای هر پرس‌وجو) | سریع (حدود ۵ تا ۱۰ میلی‌ثانیه روی GPU) |
| امتیازدهی MaxSim | آنلاین (به ازای هر پرس‌وجو) | عملیات در سطح Token، بهینه‌سازی‌شده توسط PLAID |

**این تفکیک همان چیزی است که ColBERT را سریع می‌کند**: اسناد یک‌بار از قبل کدگذاری می‌شوند. در زمان پرس‌وجو، تنها پرس‌وجو نیاز به کدگذاری دارد و امتیازدهی صرفاً یک محاسبه‌ی ریاضی ساده روی بردارهای از پیش محاسبه‌شده است.

---

<a id="maxsim-the-core-scoring-mechanism"></a>

## الگوریتم MaxSim: سازوکار اصلی امتیازدهی

عملگر MaxSim (حداکثر شباهت / Maximum Similarity) همان سازوکاری است که تعامل دیرهنگام را ممکن می‌سازد. این عملگر از نظر مفهومی ساده اما به طرز شگفت‌آوری قدرتمند است.

### نحوه کارکرد MaxSim

<div dir="ltr">

```
For each query token qi:
  1. Compute dot product with EVERY document token dj
  2. Keep only the MAXIMUM score

Score(Q, D) = SUM over all qi of MAX over all dj of (qi . dj)
```

</div>

### یک مثال گام‌به‌گام

<div dir="ltr">

```
            d1        d2       d3       d4       d5
          Widget-X   costs    $200     per     month
  q4       0.41      0.89*    0.73     0.01     0.05
  price
  q6       0.95*     0.38     0.27     0.01     0.03
  Widget-X

  * = maximum for that query token

  MaxSim contribution from q4 ("price"): 0.89 (matched "costs")
  MaxSim contribution from q6 ("Widget-X"): 0.95 (matched "Widget-X")

  Total Score = sum of all max values across all query tokens
```

</div>

### چرا MaxSim بهتر از شباهت تک‌برداری عمل می‌کند

| ویژگی | تک‌برداری (ضرب داخلی) | الگوریتم MaxSim (تعامل دیرهنگام) |
|-------|-----------------------|------------------------|
| **سطح دانه‌بندی (Granularity)** | در سطح سند | در سطح Token |
| **تطابق جزئی (Partial matching)** | همه‌یاهیچ | واحدهای Token به‌طور مستقل مطابقت داده می‌شوند |
| **اهمیت اصطلاحات (Term importance)** | فشرده‌شده در ۱ بردار | هر Token به‌طور جداگانه اثرگذار است |
| **اصطلاحات نادر (Rare terms)** | به دلیل میانگین‌گیری تضعیف می‌شوند | به عنوان بردارهای مجزا حفظ می‌شوند |

**شهود اصلی**: در یک bi-encoder، معنای «Widget-X» به همراه «costs»، «\$200» و سایر Tokenها در یک بردار واحد میانگین‌گیری می‌شود. اگر «Widget-X» نادر باشد، سیگنال آن تضعیف و کم‌اثر می‌شود. اما در ColBERT، عبارت «Widget-X» بردار اختصاصی خود را حفظ می‌کند، بنابراین عملگر MaxSim می‌تواند یک تطابق قوی را به‌طور مستقل برای آن پیدا کند.

---

<a id="colbertv2-and-plaid-indexing"></a>

## نمایه‌سازی ColBERTv2 و PLAID

نسخه اولیه‌ی ColBERT (سال ۲۰۲۰) با یک محدودیت اساسی روبرو بود: **فضای ذخیره‌سازی**. ذخیره کردن بردارهای ۱۲۸ بعدی به ازای هر Token در هر سند بسیار پرهزینه است. یک پیکره‌ی متنی شامل ۱۰ میلیون سند که هر کدام ۲۰۰ Token دارند، برابر با ۲ میلیارد بردار Token است: حدود ۱ ترابایت در فرمت float32، و همچنان ۵۱۲ گیگابایت در فرمت float16.

### بهبودهای ColBERTv2 (سال ۲۰۲۱)

مدل ColBERTv2 دو نوآوری کلیدی را معرفی کرد:

**۱. فشرده‌سازی باقیمانده (Residual Compression)**:

<div dir="ltr">

```
Original ColBERT:
  Each token vector: 128 dims x 32-bit float = 512 bytes

ColBERTv2 Residual Compression:
  1. Cluster all token vectors into centroids (k-means)
  2. Store only the centroid ID + residual (difference)
  3. Quantize the residual to 1-2 bits per dimension

  Each token vector: ~16-32 bytes (16-32x compression)
```

</div>

**۲. نظارت نویززدایی‌شده (Denoised Supervision)**:
- آموزش بر روی نمونه‌های منفی دشوار (hard negatives) که از یک مدل معلم cross-encoder استخراج شده‌اند
- برچسب‌های cross-encoder داده‌های آموزشی نویزدار را «پاکسازی» می‌کنند
- نتیجه: کیفیت بهتر امبدینگ‌ها با وجود فشرده‌سازی

**مقایسه فضای ذخیره‌سازی ColBERTv2**:

| سیستم | فضای ذخیره‌سازی به ازای هر Token | ۱۰ میلیون سند (هر کدام ۲۰۰ Token) |
|-------|----------------------------------|----------------------------------|
| ColBERT v1 | ۵۱۲ بایت | حدود ۱ ترابایت |
| مدل ColBERTv2 (فشرده‌شده) | ۳۲ بایت | حدود ۶۴ گیگابایت |
| مدل Bi-encoder (۱ بردار به ازای هر سند) | ۳ کیلوبایت | حدود ۳۰ گیگابایت |

### موتور نمایه‌سازی PLAID: موتور نمایه‌سازی

موتور PLAID (کوتاه‌شده‌ی Performance-optimized Late Interaction Driver) موتور نمایه‌سازی و بازیابی است که ColBERT را در مقیاس بزرگ کاربردی و عملی می‌سازد.

<div dir="ltr">

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAID RETRIEVAL PIPELINE                     │
│                                                                 │
│  Stage 1: CANDIDATE GENERATION                                  │
│  ─────────────────────────────                                  │
│  For each query token, find nearest centroids                   │
│  Collect candidate passages that contain those centroids        │
│  Result: ~10,000 candidates from millions                       │
│                                                                 │
│  Stage 2: CENTROID INTERACTION (with pruning)                   │
│  ────────────────────────────────────────────                   │
│  Drop centroids whose query score is below a threshold          │
│  Approximate MaxSim using centroid-level scores only            │
│  Filter candidates to top ~1,000                                │
│                                                                 │
│  Stage 3: CENTROID INTERACTION (no pruning)                     │
│  ──────────────────────────────────────────                     │
│  Re-score survivors with all of their centroid IDs              │
│  (still no residuals decompressed)                              │
│  Filter to top ~100                                             │
│                                                                 │
│  Stage 4: FULL DECOMPRESSION                                    │
│  ────────────────────────────                                   │
│  Fully decompress token vectors for top candidates              │
│  Compute full MaxSim on the decompressed vectors                │
│  Return final ranked results                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

</div>

**نکته کلیدی**: موتور PLAID از خروج از حالت فشرده (decompress) برای همه‌ی بردارهای تمام اسناد جلوگیری می‌کند. هر مرحله، مجموعه‌ی کاندیداها را با هزینه‌ای اندک فیلتر می‌کند تا امتیازدهی کامل و پرهزینه فقط روی بخش بسیار کوچکی از کل پیکره انجام شود.

**کارایی PLAID**:
- بازیابی از میان بیش از ۱۰ میلیون سند در زمان **۵۰ تا ۱۰۰ میلی‌ثانیه** روی یک GPU منفرد
- محاسبه‌ی کامل MaxSim تنها برای کاندیداهای نهایی، بر روی بردارهای باقیمانده‌ی از فشرده‌سازی خارج‌شده (دارای اتلاف / lossy). مراحل انتخاب کاندید تقریبی هستند، بنابراین بازخوانی (recall) به این بستگی دارد که چقدر هرس کردن (pruning) را تهاجمی تنظیم کنید (`ncells` و آستانه امتیاز سنتروید)؛ آن را در مقایسه با MaxSim جامع بر روی یک نمونه اندازه بگیرید
- استفاده از هرس سنتروید (centroid pruning) برای صرف‌نظر کردن از بیش از ۹۹ درصد پیکره پیش از انجام امتیازدهی کامل

---

<a id="multi-vector-in-general-purpose-vector-dbs-muvera"></a>

## چندبرداری در پایگاه‌های داده برداری (Vector Database) چندمنظوره (MUVERA)

موتور PLAID یک موتور اختصاصی با هدف مشخص است و بیشتر تیم‌ها تمایلی به راه‌اندازی یک سیستم جستجوی مجزا صرفاً برای تعامل دیرهنگام ندارند. روش **MUVERA** (کوتاه‌شده‌ی Multi-Vector Retrieval via Fixed Dimensional Encodings، ارائه‌شده توسط Google Research در NeurIPS 2024) این شکاف را پر می‌کند: این روش مجموعه‌ی بردارهای Token یک سند را به یک بردار بلند با طول ثابت تبدیل می‌کند که ضرب داخلی آن، امتیاز MaxSim (مشابه فاصله‌ی چمفر / Chamfer) را تقریب می‌زند؛ بنابراین یک نمایه (index) معمولی تک‌برداری ANN می‌تواند کاندیداها را تولید کند.

<div dir="ltr">

```
INDEX:  doc token vectors ──► FDE transform ──► 1 fixed-length vector ──► HNSW / DiskANN
                 └──────────────────────────────► keep the multi-vector set (compressed, on disk)

QUERY:  query token vectors ──► FDE ──► ANN top-k candidates
                                              └──► full MaxSim on stored multi-vectors ──► results
```

</div>

ساختار کارکرد همانند PLAID است (کاندیداهای تقریبی کم‌هزینه، امتیازدهی کامل MaxSim روی چند صد مورد برتر)، اما مرحله‌ی تولید کاندیدا بر روی همان زیرساختی اجرا می‌شود که از قبل مدیریت می‌کنید. بردارهای FDE طویل هستند (هزاران بعد)، بنابراین معمولاً کوانتایز (quantize) می‌شوند.

**پشتیبانی موتورها، اکتبر ۲۰۲۶:**

| موتور | پشتیبانی از چندبرداری (Multi-vector) | وضعیت |
|-------|--------------------------------------|-------|
| **Milvus 3.0** | ساختار EmbList روی دیسک + نمایه DiskANN برای فهرست‌های امبدینگ، همراه با شتاب‌دهی MUVERA و LEMUR | نسخه‌ی پایدار (GA) در ۲۹ ژوئیه ۲۰۲۶ (نسخه 3.0.2 در ۲۰ سپتامبر) |
| **Weaviate** | امبدینگ‌های چندبرداری نیتیو (نسخه 1.29 به بعد)، با کدگذاری اختیاری MUVERA روی HNSW از نسخه 1.31 (سال ۲۰۲۵)؛ پشتیبانی MUVERA برای نمایه مبتنی بر دیسک HFresh در نسخه 1.40 جدید است | قابلیت چندبرداری و MUVERA روی HNSW عرضه شده است؛ مسیر HFresh MUVERA در نسخه 1.40.0 (۷ اکتبر ۲۰۲۶) بدون برچسب GA یا پیش‌نمایش در توضیحات منتشر شده است، بنابراین وضعیت آن را بررسی کنید |
| **Qdrant** | فیلدهای چندبرداری نیتیو با امتیازدهی MaxSim | عرضه شده؛ مجموعه‌داده متن‌باز PubMed-Multi-Vector متعلق به Qdrant (شامل ۸.۳۷ میلیارد بردار Token مدل BGE-M3) عملکرد متراکم (dense) در برابر تنک (sparse) در برابر ColBERT را محک می‌زند |
| **Vespa** | رتبه‌بندی تنسور نیتیو ColBERT | عرضه شده |

در بخش مدل‌ها: Answer.AI خروجی‌های فرمت ONNX از مدل‌های micro و small مربوط به ColBERT-MUVERA از NeuML را در ۱۸ سپتامبر ۲۰۲۶ منتشر کرد.

<a id="compressing-the-vectors-themselves"></a>

### فشرده‌سازی خود بردارها

اهرم دیگر، ذخیره‌سازی بردارهای کمتر به ازای هر سند است. برای بازیاب‌های تصویر صفحه (به سبک ColPali)، مقاله‌ی GLIE (شماره‌ی arXiv 2609.11808، سپتامبر ۲۰۲۶) نشان می‌دهد که بردارهای Token در اسناد بصری در نزدیکی یک مانیفلد با بعد ذاتی پنج تا شش روی کره‌ی واحد قرار می‌گیرند. دو نتیجه‌ی عملی حاصل از این یافته عبارتند از: نرمال‌سازی مجدد سنترویدهای k-means بر روی کره، یک تصحیح بدون هزینه است که تا 0.093+ در معیار nDCG@5 نسبت به سنترویدهای خام بهبود ایجاد می‌کند؛ و نگه‌داشتن ۴ بردار آموزش‌دیده به ازای هر صفحه به‌همراه یک دیکودر با ۴۱۵ هزار پارامتر که مجموعه‌ی کامل را برای کاندیداهای برتر بازتولید می‌کند، نزدیک به ۸۰ درصد از nDCG@5 غیرفشرده را در بنچمارک ViDoRe v1 حفظ می‌کند (در مقایسه با ۷۰ درصد برای بهترین روش پیشین post-hoc). این صرفاً یک نتیجه‌ی پژوهشی منفرد است و نه ویژگی یک موتور، اما جهت مشابهی را نشان می‌دهد: نمایش فشرده برای کاندیداها، و امتیازدهی کامل چندبرداری تنها برای رتبه‌های برتر.

---

<a id="late-interaction-vs-alternatives"></a>

## تعامل دیرهنگام (Late Interaction) در مقایسه با روش‌های جایگزین

### مقایسه جامع

| بُعد مقایسه | BM25 | Bi-Encoder | ColBERT (Late) | Cross-Encoder |
|-----------|------|-----------|----------------|---------------|
| **کدگذاری (Encoding)** | فراوانی اصطلاحات (Term frequency) | ۱ بردار به ازای هر سند | تعداد N بردار به ازای هر سند | مشترک (بدون پیش‌محاسبه) |
| **تاخیر (Latency) پرس‌وجو** | حدود ۵ میلی‌ثانیه (~5ms) | حدود ۱۰ میلی‌ثانیه (~10ms) | حدود ۳۰ تا ۵۰ میلی‌ثانیه (~30-50ms) | بیش از ۵۰۰ میلی‌ثانیه (~500ms+) به ازای هر جفت |
| **مقیاس‌پذیری (Scalability)** | میلیاردها | میلیاردها | بیش از ۱۰۰ میلیون (+100M) | حدود ۱۰ هزار (~10K - صرفاً برای بازرتبه‌بندی) |
| **فضای ذخیره‌سازی (۱ میلیون سند)** | حدود ۲ گیگابایت (~2 GB) | حدود ۳ گیگابایت (~3 GB) | حدود ۶ تا ۱۲ گیگابایت (~6-12 GB) | ۰ (بدون ایندکس) |
| **دقت (NDCG@10)** | ۰.۳۰-۰.۳۵ | ۰.۳۵-۰.۴۰ | ۰.۳۹-۰.۴۴ | ۰.۴۲-۰.۴۶ |
| **انتقال به دامنه دیگر (Domain transfer)** | قوی (واژگانی) | ضعیف (نیازمند Fine-tuning) | قوی (در سطح Token) | قوی‌ترین |
| **پیچیدگی راه‌اندازی** | کم | متوسط | بالا | کم (بدون ایندکس) |

### چه زمانی ColBERT برتر است

<div dir="ltr">

```
                  ▲ Accuracy
                  │
             0.45 ┤                     ● Cross-Encoder
                  │                   ●
             0.40 ┤              ● ColBERT
                  │         ●
             0.35 ┤    ● Bi-Encoder
                  │ ●
             0.30 ┤ BM25
                  │
                  └────┬────┬────┬────┬────┬──► Throughput (QPS)
                      10   100  1K   10K  100K
```

</div>

**مدل ColBERT در نقطه تعادل ایده‌آل (Sweet spot) قرار دارد**: این مدل معمولاً چند امتیاز NDCG بالاتر از یک bi-encoder با اندازه مشابه به دست می‌آورد، و بیشترین میزان بهبود آن روی مجموعه‌های خارج از دامنه (Out-of-domain) و پر از اصطلاحات تخصصی حاصل می‌شود (تا بیش از ۱۳.۸٪ افزایش mAP در مجموعه داده‌های تخصصی)، در حالی که ۱۰ تا ۵۰ برابر سریع‌تر از cross-encoderها است.

---

<a id="implementation-with-ragatouille"></a>

## پیاده‌سازی با RAGatouille

کتابخانه RAGatouille (توسعه‌داده‌شده توسط Answer.AI) کتابخانه استاندارد پایتون برای استفاده از ColBERT در خطوط لوله (Pipelines) مربوط به RAG است. این کتابخانه کدهای ColBERT استنفورد را در قالب یک API ساده و سطح بالا ارائه می‌دهد.

### کاربرد پایه

<div dir="ltr">

```python
from ragatouille import RAGPretrainedModel

# Load a pretrained ColBERT model
RAG = RAGPretrainedModel.from_pretrained("colbert-ir/colbertv2.0")

# Index documents (one-time, creates PLAID index on disk)
documents = [
    "Widget-X costs $200 per month for the Standard plan.",
    "The Enterprise plan includes SSO and audit logs for $800/month.",
    "All plans include 99.9% uptime SLA and 24/7 email support.",
    "Widget-X was launched in 2023 and serves 10,000+ customers.",
]

index_path = RAG.index(
    index_name="products",
    collection=documents,
    split_documents=True  # auto-chunk long docs
)

# Search the index
results = RAG.search(
    query="How much does Widget-X cost?",
    k=3
)

for result in results:
    print(f"Score: {result['score']:.4f}")
    print(f"Text:  {result['content']}\n")
```

</div>

### یکپارچه‌سازی با LangChain

<div dir="ltr">

```python
from ragatouille import RAGPretrainedModel
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# Create ColBERT retriever
RAG = RAGPretrainedModel.from_pretrained("colbert-ir/colbertv2.0")
retriever = RAG.as_langchain_retriever(k=5)

# Build RAG chain
template = """Answer based on the following context:
{context}

Question: {question}"""

prompt = ChatPromptTemplate.from_template(template)
llm = ChatOpenAI(model="gpt-4o")

chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | llm
)

response = chain.invoke("What features does the Enterprise plan include?")
```

</div>

### سایر کتابخانه‌ها و یکپارچه‌سازی‌های ColBERT

| کتابخانه | مورد استفاده (Use Case) | نکات |
|---------|----------|-------|
| **RAGatouille** | اولویت پایتون، API ساده | بهترین گزینه برای نمونه‌سازی اولیه و مقیاس‌های کوچک تا متوسط |
| **کتابخانه colbert-ai** (استنفورد) | پژوهشی، کنترل کامل | سطح پایین‌تر، با گزینه‌های پیکربندی بیشتر |
| **Vespa** | استقرار (Deployment) در مقیاس عملیاتی | زیرساخت مدیریت‌شده با پشتیبانی بومی از ColBERT |
| **PyLate** | آموزش/Fine-tuning انعطاف‌پذیر | ساخته‌شده بر پایه Sentence Transformers، مناسب برای مدل‌های سفارشی |
| **Jina ColBERT v2** | چندزبانه (۸۹ زبان) | ابعاد خروجی انعطاف‌پذیر، آماده برای محیط عملیاتی (Production-ready) |
| **Milvus 3.0 / Weaviate / Qdrant** | چندبرداری درون یک پایگاه داده برداری (Vector Database) عمومی | الگوریتم MUVERA یا MaxSim بومی؛ به جدول موتورها در بالا مراجعه کنید |

---

<a id="production-deployment-patterns"></a>

## الگوهای استقرار (Deployment) در محیط عملیاتی

### الگوی ۱: ColBERT به عنوان بازیاب اولیه (Primary Retriever)

<div dir="ltr">

```
Query ──► ColBERT (PLAID) ──► Top 20 ──► LLM
```

</div>

مناسب‌ترین حالت برای: مجموعه‌های با مقیاس متوسط (۱ تا ۵۰ میلیون سند) که در آن‌ها دقت بالاترین اهمیت را دارد و امکان تقبل سربار فضای ذخیره‌سازی وجود دارد.

### الگوی ۲: ColBERT به عنوان بازرتبه‌بندی‌کننده (Reranker - متداول‌ترین حالت)

<div dir="ltr">

```
Query ──► BM25 or Bi-Encoder ──► Top 1000 ──► ColBERT Rerank ──► Top 20 ──► LLM
```

</div>

مناسب‌ترین حالت برای: سیستم‌های مقیاس بزرگ که در آن‌ها بازیابی مرحله اول باید کم‌هزینه باشد، اما به بازرتبه‌بندی با کیفیت بالا بدون هزینه‌های یک cross-encoder نیاز دارید.

<div dir="ltr">

```
┌─────────────────────────────────────────────────────────────────┐
│              COLBERT-AS-RERANKER ARCHITECTURE                   │
│                                                                 │
│  User Query                                                     │
│      │                                                          │
│      ▼                                                          │
│  First Stage: BM25 / Bi-Encoder                                 │
│  (cheap, high recall, Top 1000)                                 │
│      │                                                          │
│      ▼                                                          │
│  Second Stage: ColBERT MaxSim Reranking                         │
│  (pre-computed doc tokens, score Top 1000)                      │
│  Cost: only query encoding + MaxSim arithmetic                  │
│      │                                                          │
│      ▼                                                          │
│  Top 20 Passages ──► LLM Generation                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

</div>

### الگوی ۳: هیبرید (ColBERT + BM25 + Dense)

<div dir="ltr">

```
Query ──┬──► BM25 (Top 50) ────────┐
        ├──► Dense Bi-Encoder (50) ─┼──► RRF ──► ColBERT Rerank ──► Top 10
        └──► ColBERT (Top 50) ─────┘
```

</div>

مناسب‌ترین حالت برای: حداکثر دقت در مقیاس متوسط. پرهزینه است اما تمامی شیوه‌های بازیابی (Retrieval modalities) را پوشش می‌دهد.

### ملاحظات فضای ذخیره‌سازی و زیرساخت

| اندازه مجموعه اسناد (Corpus Size) | فضای ذخیره‌سازی Bi-Encoder | فضای ذخیره‌سازی ColBERT | نیازمندی GPU |
|------------|-------------------|-----------------|-----------------|
| ۱۰۰ هزار سند (100K) | حدود ۳۰۰ مگابایت (~300 MB) | حدود ۶۰۰ مگابایت تا ۱.۲ گیگابایت (~600 MB - 1.2 GB) | فقط CPU بلامانع است |
| ۱ میلیون سند (1M) | حدود ۳ گیگابایت (~3 GB) | حدود ۶ تا ۱۲ گیگابایت (~6-12 GB) | ۱ عدد GPU توصیه می‌شود |
| ۱۰ میلیون سند (10M) | حدود ۳۰ گیگابایت (~30 GB) | حدود ۶۰ تا ۱۲۰ گیگابایت (~60-120 GB) | ۱ تا ۲ عدد GPU مورد نیاز است |
| ۱۰۰ میلیون سند (100M) | حدود ۳۰۰ گیگابایت (~300 GB) | حدود ۶۰۰ گیگابایت تا ۱.۲ ترابایت (~600 GB - 1.2 TB) | چند GPU / توزیع‌شده |

**ارزیابی واقع‌بینانه (Reality check)**: فضای ذخیره‌سازی ColBERT حدود ۲ تا ۴ برابر bi-encoderها است. برای اکثر موارد کاربرد RAG (زیر ۱۰ میلیون سند)، این مقدار قابل مدیریت است. برای جستجو در مقیاس وب (میلیاردها صفحه)، bi-encoderها یا روش‌های تنک یادگیری‌شده (Learned sparse methods) همچنان برای مرحله اول بازیابی کاربردی‌تر هستند. تولید نامزدها به سبک MUVERA روی یک ایندکس مقیم بر دیسک (Disk-resident index) (امروزه DiskANN در Milvus 3.0، و HFresh در Weaviate پس از انتشار عمومی نسخه 1.40) سقف حافظه RAM را به میزان چشمگیری افزایش می‌دهد، زیرا تنها ایندکس تک‌برداری FDE باید به صورت فعال در حافظه (Hot) قرار داشته باشد.

---

<a id="when-to-choose-colbert"></a>

## چه زمانی ColBERT را انتخاب کنیم

### چارچوب تصمیم‌گیری (Decision Framework)

<div dir="ltr">

```
Is your corpus < 100M documents?
├── No  ──► Use Bi-Encoder for retrieval + ColBERT for reranking
└── Yes
    │
    Is accuracy more important than infrastructure simplicity?
    ├── No  ──► Use Bi-Encoder (simpler, cheaper)
    └── Yes
        │
        Can you afford 2-4x storage vs. bi-encoder?
        ├── No  ──► Use Bi-Encoder + Cross-Encoder reranker
        └── Yes
            │
            Do you want to run a separate retrieval engine?
            ├── No  ──► MUVERA / native multi-vector in your vector DB
            └── Yes ──► Use ColBERT (PLAID) as primary retriever
```

</div>

### مقایسه ColBERT با بازیابی متراکم (Dense Retrieval) و جستجوی هیبرید

| سناریو | بهترین انتخاب | دلیل |
|----------|-------------|-----|
| معماری RAG با کاربرد عمومی (کمتر از ۱ میلیون سند) | هیبرید (Dense + BM25) | ساده‌ترین روش، دقت به‌اندازه کافی خوب |
| جستجوی اختصاصی دامنه (حقوقی، پزشکی) | ColBERT | تطبیق در سطح Token اصطلاحات تخصصی را حفظ می‌کند |
| مجموعه اسناد چندزبانه | Jina ColBERT v2 | پشتیبانی بومی از ۸۹ زبان |
| حساس به هزینه، حجم بالا | Bi-Encoder + BM25 | کمترین میزان ذخیره‌سازی و محاسبات |
| حداکثر دقت، مقیاس متوسط | مدل ColBERT + بازرتبه‌بندی‌کننده (Reranker) | بهترین کیفیت بدون تاخیر (Latency) مدل‌های cross-encoder |
| مقیاس وب (بیش از ۱ میلیارد سند) | مرحله اول Bi-Encoder + بازرتبه‌بندی با ColBERT | ایندکس ColBERT برای بازیابی اولیه بیش از حد بزرگ است |

---

<a id="interview-questions"></a>

## سوالات مصاحبه

### پرسش: تفاوت بین مدل‌های bi-encoder، cross-encoder و مدل‌های تعامل دیرهنگام (Late Interaction) را توضیح دهید. چه زمانی هر یک از آن‌ها را انتخاب می‌کنید؟

**پاسخ قوی:**
تفاوت این سه معماری در این است که پرس‌وجو (Query) و سند *چه زمانی* با یکدیگر تعامل برقرار می‌کنند:

**مدل‌های Bi-encoder** پرس‌وجو و سند را به صورت مستقل به بردارهای تکی کدگذاری می‌کنند. تعامل تنها از طریق یک ضرب داخلی (Dot product) در پایان رخ می‌دهد. این روش سریع است (تمام بردارهای اسناد از قبل محاسبه می‌شوند و جستجو ظرف چند میلی‌ثانیه انجام می‌گیرد)، اما تطبیق ریزدانه (Fine-grained) را از دست می‌دهد: کل مفهوم سند در یک نقطه منفرد در فضای برداری فشرده می‌شود.

**مدل‌های Cross-encoder** ترکیب متصل‌شده پرس‌وجو + سند را از طریق یک ترنسفورمر منفرد پردازش می‌کنند. خودتوجهی کامل (Full self-attention) به این معناست که هر Token پرس‌وجو به تک‌تک Tokenهای سند توجه (Attend) می‌کند. این رویکرد بالاترین دقت را ارائه می‌دهد اما هیچ چیزی را نمی‌توان از قبل محاسبه کرد. هر جفت پرس‌وجو-سند نیازمند یک مرحله انتشار رو به جلوی کامل (Forward pass) است که این امر استفاده از آن را برای بازیابی مرحله اول غیرعملی می‌سازد. مدل‌های Cross-encoder به عنوان بازرتبه‌بندی‌کننده (Reranker) بر روی ۱۰ تا ۱۰۰ نامزد برتر مورد استفاده قرار می‌گیرند.

**تعامل دیرهنگام یا Late interaction (مانند ColBERT)** پرس‌وجو و سند را به صورت مستقل (مشابه bi-encoderها) کدگذاری می‌کند، اما به جای بردارهای تکی، آن‌ها را به ماتریس‌های برداری *به ازای هر Token* تبدیل می‌نماید. امتیازدهی از مکانیزم MaxSim بهره می‌برد: برای هر Token پرس‌وجو، بهترین Token تطبیق‌یافته در سند پیدا می‌شود. این سازوکار دانه‌بندی در سطح Token را حفظ کرده و در عین حال پیش‌محاسبه اسناد را امکان‌پذیر می‌سازد. نتیجه حاصل، دقتی نزدیک به cross-encoder با سرعتی در حد bi-encoder است.

من bi-encoderها را برای بازیابی مرحله اول در مقیاس بزرگ که سادگی در اولویت است انتخاب می‌کنم؛ cross-encoderها را برای بازرتبه‌بندی بسیار حساس روی مجموعه‌های کوچک از نامزدها به کار می‌برم؛ و ColBERT را زمانی برمی‌گزینم که به دقت یک cross-encoder نیاز داشته باشم اما نتوانم تاخیر (Latency) آن را تقبل کنم، به‌ویژه برای جستجوهای متناسب با دامنه‌های تخصصی که در آن‌ها تطبیق در سطح اصطلاحات حیاتی است (اسناد حقوقی، پزشکی و فنی).

### پرسش: مدل ColBERT به ازای هر Token یک بردار ذخیره می‌کند. این مدل چگونه مقیاس‌پذیر می‌شود و موازنه‌های مربوط به فضای ذخیره‌سازی در آن چیست؟

**پاسخ قوی:**
هزینه خام (Naive) ذخیره‌سازی در ColBERT قابل توجه است. یک سند شامل ۲۰۰ عدد Token به ۲۰۰ بردار با ابعاد ۱۲۸ نیاز دارد (۲۵,۶۰۰ عدد اعشاری یا Float)، در حالی که برای یک bi-encoder تنها ۱ بردار با ابعاد ۷۶۸ تا ۱۰۲۴ نیاز است. این رقم قبل از اعمال فشرده‌سازی، تقریباً ۲۵ تا ۳۳ برابر فضای ذخیره‌سازی بیشتر به ازای هر سند است.

مدل ColBERTv2 این چالش را با **فشرده‌سازی باقی‌مانده (Residual compression)** برطرف می‌سازد: بردارهای Token در مرکزهای خوشه (Centroids) خوشه‌بندی می‌شوند و تنها شناسه (ID) مرکز به همراه یک باقیمانده کوانتیزه‌شده ذخیره می‌گردد. این راهکار به فشرده‌سازی ۱۶ تا ۳۲ برابری به ازای هر بردار Token دست می‌یابد و فضای ذخیره‌سازی عملیاتی را به حدود ۲ تا ۴ برابر یک bi-encoder با فرمت float32 می‌رساند.

موتور ایندکس‌گذاری PLAID با استفاده از یک خط لوله چندمرحله‌ای، کارایی را در زمان اجرای پرس‌وجو ارتقای بیشتری می‌بخشد. این موتور نامزدها را بر اساس نزدیک‌ترین مرکزها (Centroids) به هر Token پرس‌وجو تولید می‌کند، آن‌ها را تنها بر اساس شناسه مرکزها امتیازدهی می‌نماید (ابتدا مرکزهای با امتیاز پایین هرس می‌شوند) تا ۹۹٪ از کل مجموعه اسناد حذف شود، و مقادیر باقیمانده را فقط برای نامزدهای نهایی از حالت فشرده خارج می‌سازد. محاسبه نهایی و کامل MaxSim، بر روی بردارهای باقیمانده بازشده از فشرده‌سازی، برای کمتر از ۱۰۰ سند انجام می‌شود که این کار تاخیر (Latency) را حتی در مجموعه‌های شامل بیش از ۱۰ میلیون سند در محدوده ۵۰ تا ۱۰۰ میلی‌ثانیه حفظ می‌کند. با توجه به اینکه مراحل غربال‌گری نامزدها تقریبی هستند، من پیش از تنظیم تهاجمی هرس‌کردن (Pruning)، نرخ بازیابی (Recall) را روی یک نمونه آماری در مقایسه با MaxSim جامع اندازه‌گیری می‌کنم.

برای مقیاس‌های فراتر از ۱۰۰ میلیون سند، من از ColBERT به عنوان بازرتبه‌بندی‌کننده (Reranker) و نه بازیاب اولیه استفاده خواهم کرد: اجازه دهید یک bi-encoder یا BM25 بازیابی مرحله اول را انجام دهد تا مجموعه نامزدها به ۱,۰۰۰ سند کاهش یابد، سپس از MaxSim مدل ColBERT برای بازرتبه‌بندی با کیفیت بالا بهره بگیرید. چنانچه تیم در حال حاضر از Milvus، Qdrant یا Weaviate استفاده می‌کند، راهکار میانی MUVERA است: یک کدگذاری با ابعاد ثابت (Fixed-dimensional encoding) به ازای هر سند برای تولید نامزد با روش ANN ایندکس می‌شود و بردارهای فشرده‌شده Token روی دیسک نگهداری می‌شوند تا MaxSim کامل روی چند صد سند برتر به اجرا درآید.

### پرسش: شما در حال طراحی یک سیستم جستجوی اسناد حقوقی با ۵ میلیون سند هستید. اعضای تیم بر سر انتخاب بین جستجوی متراکم bi-encoder همراه با بازرتبه‌بندی‌کننده cross-encoder در برابر ColBERT به بحث پرداخته‌اند. پیشنهاد شما چیست؟

**پاسخ قوی:**
من برای این سناریو به سه دلیل ColBERT را توصیه می‌کنم:

نخست اینکه **متون حقوقی نسبت به اصطلاحات تخصصی حساس هستند (Term-sensitive)**. بندهای قرارداد به شماره بخش‌های مشخص، اصطلاحات تعریف‌شده (مانند «فورس ماژور» / "Force Majeure") و عبارات دقیق ارجاع می‌دهند. تطبیق MaxSim در سطح Token مدل ColBERT این اصطلاحات نادر اما حیاتی را حفظ می‌کند، در حالی که اثر آن‌ها در یک جاسازی (Embedding) تک‌برداری bi-encoder حل شده و تقلیل می‌یابد.

دوم اینکه **۵ میلیون سند دقیقاً در نقطه تعادل ایده‌آل (Sweet spot) مدل ColBERT قرار دارد**. با فشرده‌سازی ColBERTv2، اندازه ایندکس حدود ۳۰ تا ۶۰ گیگابایت خواهد بود که روی یک GPU منفرد ۸۰ گیگابایتی جای می‌گیرد. این حجم به اندازه کافی کوچک است که بتوان از آن برای بازیابی اولیه استفاده کرد و نیاز به یک بازیاب مرحله اول مجزا را برطرف می‌سازد.

سوم اینکه **بازرتبه‌بندی با cross-encoder تاخیر (Latency) بالایی تحمیل می‌کند**. هر جفت پرس‌وجو-سند به یک مرحله انتشار رو به جلوی کامل در ترنسفورمر نیاز دارد. بازرتبه‌بندی ۱۰۰ نامزد با یک cross-encoder ممکن است ۵۰۰ میلی‌ثانیه تا ۲ ثانیه طول بکشد. ColBERT به دقتی قابل مقایسه دست می‌یابد در حالی که به دلیل پیش‌محاسبه شدن Tokenهای سند، تاخیر کل را زیر ۱۰۰ میلی‌ثانیه نگه می‌دارد.

تنها بخشی که ColBERT را تکمیل خواهم کرد، افزودن یک ایندکس موازی BM25 برای پرس‌وجوهای با تطبیق دقیق (شماره قوانین، ارجاعات دعاوی قضایی) است که دقت کلیدواژه‌ها در آن‌ها اهمیت دارد. من از الگوریتم RRF برای ترکیب نتایج ColBERT و BM25 پیش از انتقال به LLM استفاده خواهم کرد.

---

<a id="references"></a>

## منابع
- خطاب و زاهاریا (Khattab & Zaharia). «ColBERT: Efficient and Effective Passage Search» (SIGIR 2020)
- سانتانام و همکاران (Santhanam et al). «ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction» (NAACL 2022)
- سانتانام و همکاران (Santhanam et al). «PLAID: An Efficient Engine for Late Interaction Retrieval» (CIKM 2022)
- Answer.AI. «RAGatouille: State-of-the-art Late Interaction Retrieval» (GitHub, 2024)
- Jina AI. «Jina-ColBERT-v2: General-Purpose Multilingual Late Interaction Retriever» (2024)
- دولیپالا و همکاران (Dhulipala et al). «MUVERA: Multi-Vector Retrieval via Fixed Dimensional Encodings» (NeurIPS 2024)
- Weaviate. «An Overview of Late Interaction Retrieval Models» (2025)
- Milvus. «v3.0.0 release notes» (GitHub, July 2026)
- مقاله GLIE, arXiv 2609.11808: فشرده‌سازی جاسازی‌های چندبرداری اسناد بصری (سپتامبر ۲۰۲۶)
- کنفرانس ECIR 2026. «کارگاه تعامل دیرهنگام (Late Interaction Workshop)» (2026)

---

*قبلی: [بازیابی بافتاری (Contextual Retrieval)](10-contextual-retrieval.md) | بعدی: [RAG چندوجهی (Multi-Modal RAG)](12-multimodal-rag.md)*

</div>
