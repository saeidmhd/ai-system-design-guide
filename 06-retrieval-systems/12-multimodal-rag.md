<div dir="rtl">

# معماری RAG چندوجهی (Multi-Modal RAG)

سیستم‌های `RAG` چندوجهی، فرآیند بازیابی افزوده تولید (Retrieval-Augmented Generation) را فراتر از متن خام گسترش می‌دهند تا تصاویر، جداول، نمودارها، صوت و اسنادی با چیدمان ترکیبی (mixed-layout) را مدیریت کنند. سیستم‌های محیط عملیاتی (production) امروزه به طور معمول فایل‌های PDF شامل دیاگرام‌ها، اسلایدهای ارائه، فاکتورهای اسکن‌شده و مقالات پژوهشی را پردازش و وارد سیستم (ingest) می‌کنند؛ جاهایی که چیدمان بصری *خودِ* معنا و مفهوم است. سه معماری غالب وجود دارد: زیرنویس و نمایه‌سازی (caption-and-index)، امبدینگ‌های یکپارچه بینایی-متن (Cohere Embed 5، Voyage-Multimodal-3.5، Gemini Embedding 2) و صفحه به عنوان تصویر با تعامل دیرهنگام (ColPali، ColQwen2.5، ColNomic). ویدیو جدیدترین وجه (modality) است که مدل هزینه اختصاصی خود را پیدا کرده است، زیرا اکنون مدل‌ها می‌توانند به جای نمونه‌برداری از تک‌تک فریم‌ها، بخش‌های مورد نظر را برای مشاهده انتخاب کنند.

## فهرست مطالب

- [چرا RAG صرفاً متنی شکست می‌خورد](#why-text-only-rag-fails)
- [الگوهای معماری](#architecture-patterns)
- [استراتژی‌های امبدینگ چندوجهی](#multi-modal-embedding-strategies)
- [مدل‌های بینایی-زبان برای درک اسناد](#vision-language-models-for-document-understanding)
- [ColPali و بازیابی مبتنی بر بینایی](#colpali-and-vision-based-retrieval)
- [استخراج جدول و بازیابی داده‌های ساختاریافته](#table-extraction-and-structured-data-retrieval)
- [درک نمودارها و دیاگرام‌ها](#chart-and-diagram-understanding)
- [ویدیو: نمونه‌برداری ثابت در برابر پردازش مبتنی بر Agent](#video-fixed-sampling-vs-agentic-processing)
- [معماری محیط عملیاتی](#production-architecture)
- [نمونه پیاده‌سازی](#implementation-example)
- [زاویه دید مصاحبه طراحی سیستم](#system-design-interview-angle)
- [منابع](#references)

---

## چرا RAG صرفاً متنی شکست می‌خورد

خطوط لوله سنتی `RAG` اسناد را به قطعات متنی (text chunks) تجزیه کرده، آن‌ها را امبد می‌کنند و در برابر یک پرس‌وجوی متنی به بازیابی می‌پردازند. این فرآیند روی اسناد دنیای واقعی با شکست مواجه می‌شود:

| عنصر سند | رفتار RAG صرفاً متنی | اطلاعات واقعی از دست رفته |
|-----------------|----------------------|------------------------|
| **نمودار میله‌ای (Bar Chart)** | فقط برچسب‌های محور را استخراج می‌کند | روندها، مقایسه‌ها، مقادیر و بزرگی‌ها |
| **دیاگرام معماری (Architecture Diagram)** | کاملاً نادیده می‌گیرد | روابط بین اجزا، جریان داده |
| **جدول (Table)** | ردیف‌های مسطح‌شده ساختار را از دست می‌دهند | ارتباط سطر و ستون، سرستون‌ها (headers) |
| **اینفوگرافیک (Infographic)** | قطعات متنی پراکنده را دریافت می‌کند | سلسله‌مراتب بصری، گروه‌بندی‌های مکانی |
| **عکس همراه با زیرنویس (Photo with Caption)** | زیرنویس را دریافت می‌کند، تصویر را از دست می‌دهد | شواهد بصری، بافت و زمینه مکانی |

**واقعیت**: بین ۴۰ تا ۶۰ درصد محتوای اسناد سازمانی غیرمتنی است. ارزش یک گزارش مالی در نمودارهای آن نهفته است. یافته کلیدی یک مقاله پزشکی در اشکال آن قرار دارد. نادیده گرفتن محتوای بصری به معنای چشم‌پوشی از بخش عمده دانش است.

---

## الگوهای معماری

سه الگوی غالب برای `RAG` چندوجهی وجود دارد که هر کدام مصالحه‌ها و موازنه‌های (trade-offs) متمایزی دارند:

### الگوی ۱: فضای امبدینگ یکپارچه (Unified Embedding Space)

<div dir="ltr">

```
                     Shared Vector Space
                    +-------------------+
  Text  --> Encoder |  [0.2, 0.8, ...] |
  Image --> Encoder |  [0.3, 0.7, ...] |  --> Single Index --> Retrieve
  Table --> Encoder |  [0.1, 0.9, ...] |
                    +-------------------+

  Query "show revenue trends" --> encode --> nearest neighbors across ALL modalities
```

</div>

- **نحوه کار (How)**: استفاده از مدلی مانند CLIP یا SigLIP برای تصاویر طبیعی، یا یک مدل امبدینگ چندوجهی در سطح سند (Cohere Embed 5، Gemini Embedding 2، Voyage Multimodal) برای صفحات، اسلایدها و اسکرین‌شات‌ها، جهت تصویر کردن (project) متن و تصویر در یک فضای برداری مشترک.
- **مزایا (Pros)**: شاخص (index) واحد، پرس‌وجوی واحد، منطق بازیابی ساده.
- **معایب (Cons)**: کیفیت امبدینگ در وجوه (modalities) مختلف متغیر است؛ جداول نیاز به سریال‌سازی (serialization) دارند.

### الگوی ۲: بازیابی مختص هر وجه همراه با ادغام (Modality-Specific Retrieval with Fusion)

<div dir="ltr">

```
  Query --> +----> Text Index    --> Top-K text chunks
            |
            +----> Image Index   --> Top-K images
            |
            +----> Table Index   --> Top-K tables
            |
            v
        Fusion / Reranking Layer --> Combined Top-K --> VLM Generator
```

</div>

- **نحوه کار (How)**: امبدینگ‌ها و ایندکس‌های مجزا به ازای هر وجه. یک بازرتبه‌بند (reranker) یا ادغام رتبه متقابل (RRF) نتایج را ترکیب می‌کند.
- **مزایا (Pros)**: دستیابی به بهترین امبدینگ در هر وجه؛ امکان تنظیم (tune) مستقل هر بازیاب (retriever).
- **معایب (Cons)**: پیچیدگی زیرساختی بیشتر؛ منطق فیوژن (ادغام) پیچیده است.

### الگوی ۳: اولویت بینایی (صفحه به عنوان تصویر / Page-as-Image)

<div dir="ltr">

```
  Document Page --> Screenshot/Render --> Vision Encoder --> Multi-vector Index
                                              |
  Query ---------> Text Encoder --------------+---> Late Interaction Score
                                                    --> Retrieve top pages
```

</div>

- **نحوه کار (How)**: در نظر گرفتن هر صفحه سند به عنوان یک تصویر. استفاده از یک مدل بینایی-زبان (مانند ColPali) برای ایجاد امبدینگ‌ها در سطح پَچ (patch-level). امتیازدهی از طریق تعامل دیرهنگام (MaxSim / Late Interaction).
- **مزایا (Pros)**: بدون نیاز به OCR، تحلیل چیدمان، یا خط لوله استخراج جدول. قابلیت آموزش سرتاسری (end-to-end trainable).
- **معایب (Cons)**: بار محاسباتی سنگین‌تر هنگام نمایه‌سازی؛ از دست رفتن امکان جستجوی متنی دقیق و دانه‌ریز (fine-grained).

**توصیه**: الگوی ۳ (اولویت بینایی) برای کاربردهای مبتنی بر اسناد پیچیده به سرعت در حال رشد است. اما الگوی ۲ همچنان ستون فقرات اصلی محیط‌های عملیاتی است، به‌ویژه زمانی که در کنار بازیابی بصری به جستجوی متنی دقیق نیاز دارید.

---

## استراتژی‌های امبدینگ چندوجهی

### CLIP (Contrastive Language-Image Pretraining)

انکودر دوگانه (dual-encoder) اصلی که متن و تصویر را به یک فضای مشترک ۵۱۲ یا ۷۶۸ بُعدی نگاشت می‌کند.

- **نقاط قوت (Strengths)**: اکوسیستم بسیار گسترده، شناخته‌شده و تثبیت‌شده، مدل‌های متعدد Fine-tuning شده.
- **نقاط ضعف (Weaknesses)**: عملکرد ضعیف‌تر روی تصاویر از نوع اسناد (نمودارها، جداول) در مقایسه با عکس‌های طبیعی. تابع زیان مقابله‌ای (contrastive loss) نیازمند اندازه دسته‌های (batch sizes) بزرگ است.

### SigLIP / SigLIP 2

تابع کراس انتروپی softmax در CLIP را با یک تابع زیان سیگموئید (sigmoid loss) جایگزین می‌کند و اجازه می‌دهد هر جفت تصویر-متن به طور مستقل ارزیابی شود.

- **مدل SigLIP 2 (2025)**: دیکودرهای تولید زیرنویس، خود-تقطیر (self-distillation) و پیش‌بینی پوشانده‌شده (masked prediction) را اضافه کرده است. آموزش‌دیده روی بیش از ۱۰ میلیارد تصویر در ۱۰۹ زبان.
- **موفقیت کلیدی (Key Win)**: عملکرد بهتر نسبت به CLIP در اندازه‌های دسته کوچک (۴ تا ۸ هزار) و ارائه ویژگی‌های متراکم‌تر و مستحکم‌تر.
- **کاربرد در محیط عملیاتی (Production Use)**: کتابخانه ملی نروژ، جستجوی بصری در تجارت الکترونیک، ساماندهی آثار هنری هوش مصنوعی.

### مقایسه برای RAG

| مدل | مناسب‌ترین برای | ابعاد امبدینگ | کیفیت سند | کیفیت تصویر طبیعی |
|-------|----------|--------------|-----------------|----------------------|
| CLIP ViT-L/14 | اهداف عمومی | ۷۶۸ | متوسط | بالا |
| SigLIP 2 So400m | اسناد چندزبانه | ۱۱۵۲ | بالا | بالا |
| Nomic Embed Vision | اسناد با حجم متنی بالا | ۷۶۸ | بالا | متوسط |
| Voyage Multimodal 3.5 | اسناد ترکیبی؛ متن، تصویر و ویدیو | ۲۵۶ تا ۲۰۴۸ (پیش‌فرض ۱۰۲۴) | بالا | بالا |
| Cohere embed-v5.0-pro / -fast | اسناد سازمانی غنی از نظر بصری؛ ورودی متن، تصویر یا ترکیب متن+تصویر | ۲۵۶ تا ۲۰۴۸ (Matryoshka) | بالا: ViDoRe V3 امتیاز ۸۵.۸ / ۸۴.۵ (گزارش‌شده توسط توسعه‌دهنده) | گزارش نشده |
| Gemini Embedding 2 | یک فضا برای متن، تصویر، ویدیو، صوت و PDF | ۱۲۸ تا ۳۰۷۲ (مقادیر پیشنهادی: ۷۶۸/۱۵۳۶/۳۰۷۲) | بالا: ViDoRe V3 امتیاز ۸۳.۲ (جدول ارائه‌شده توسط Cohere) | گزارش نشده |
| EmbeddingGemma 2 (open weights, Apache 2.0) | فضای واحد سلف‌هاستد (Self-hosted) برای متن، کد، تصویر، ویدیو و صوت؛ ۷۴۰ میلیون پارامتر، کانتکست 8K | ۱۲۸ تا ۷۶۸ (Matryoshka) | در ViDoRe گزارش نشده | گزارش نشده |

**آنچه در سال ۲۰۲۶ تغییر کرد**: اکنون دو امبدر چندوجهی میزبانی‌شده (hosted) الگوی «فضای یکپارچه» را بدون نیاز به یک مدل تصویر مجزا پوشش می‌دهند، و در اکتبر یک مدل با وزن‌های باز (open-weight) نیز به آن‌ها ملحق شد.
- **مدل Gemini Embedding 2** (`gemini-embedding-2`، معرفی‌شده در ۱۰ مارس، پایدار از آوریل ۲۰۲۶) مدل چندوجهی گوگل است: متن تا ۸٬۱۹۲ Token، تا ۶ تصویر، ویدیو تا ۱۲۰ ثانیه، صوت بومی (native)، و فایل‌های PDF تا ۶ صفحه به ازای هر ورودی، از جمله ورودی‌های درهم‌آمیخته (interleaved). مدل `gemini-embedding-001` صرفاً متنی است و در ۱۴ مه ۲۰۲۸ بازنشسته می‌شود؛ گوگل Gemini Embedding 2 را به عنوان جایگزین آن معرفی کرده است.
- **شرکت Cohere Embed 5** (۳۰ سپتامبر ۲۰۲۶): نسخه `embed-v5.0-pro` با هزینه ۰.۱۲ دلار و `embed-v5.0-fast` با هزینه ۰.۰۸ دلار به ازای هر ۱ میلیون Token متنی، ۰.۴۰ دلار به ازای هر ۱ میلیون Token تصویری، با کانتکست 128K. نسخه‌های Pro و Fast در یک فضای امبدینگ مشترک سهیم هستند، بنابراین می‌توانید نمایه‌سازی را با Pro انجام دهید و بدون نیاز به نمایه‌سازی مجدد، با Fast پرس‌وجو بگیرید.
- **مدل EmbeddingGemma 2** (اکتبر ۲۰۲۶، مجوز Apache 2.0): ۷۴۰ میلیون پارامتر توزیع‌شده بین یک مدل متنی ۲۷۰ میلیونی، انکودر بینایی ۱۷۰ میلیونی و انکودر صوتی ۳۰۰ میلیونی، که متن، تصویر، ویدیو و صوت را در یک فضای ۷۶۸ بُعدی نگاشت می‌کند. این مدل پاسخ سلف‌هاستد (self-hosted) برای زمان‌هایی است که صوت یا ویدیو نباید از شبکه داخلی شما خارج شود؛ اما گوگل امتیازات MTEB متن و کد را منتشر کرده است (گزارش‌شده توسط توسعه‌دهنده) و نه ViDoRe، بنابراین پیش از انتخاب آن برای اسناد، ارزیابی (eval) اختصاصی در سطح صفحه را اجرا کنید.

جدول رسمی خود Cohere برای ViDoRe V3، مدل Embed 5 Pro را با امتیاز ۸۵.۸، مدل Fast را با ۸۴.۵، مدل voyage-4-large را با ۸۳.۷، مدل Gemini Embedding 2 را با ۸۳.۲ و مدل OpenAI text-embedding-3-large را با ۷۵.۵ قرار می‌دهد. اختلاف بین چهار مدل برتر کمتر از سه نمره بوده و توسط توسعه‌دهنده گزارش شده است، بنابراین تصمیم‌گیری نهایی را به قطعیت نمی‌رساند؛ مجموعه داده ارزیابی (eval set) در سطح صفحه خود شما این کار را مشخص می‌کند.

### تصمیم‌گیری در مورد استراتژی امبدینگ

```
Is your content mostly natural images (photos, products)?
  YES --> CLIP or SigLIP fine-tuned on your domain
  NO
    |
    v
Is your content document pages (PDFs, slides, reports)?
  YES --> Baseline: single-vector multimodal embedder (Embed 5,
          Gemini Embedding 2) + reranker. Move to ColPali / ColQwen
          (multi-vector, no OCR) if page-level recall falls short
  NO
    |
    v
Is it a mix of text, images, and structured data?
  YES --> Modality-specific encoders + fusion (Pattern 2)
          or one hosted multimodal embedder (Embed 5, Gemini Embedding 2)
          if a single index matters more than per-modality tuning

Does it include audio or video clips?
  YES --> Gemini Embedding 2 for retrieval (clips up to 120 s per input),
          or EmbeddingGemma 2 if the media must stay self-hosted,
          plus transcripts in the text index for exact-term search
```

---

## مدل‌های بینایی-زبان برای درک اسناد

مدل‌های بینایی-زبان (VLMها) در `RAG` چندوجهی دو نقش ایفا می‌کنند: (۱) به عنوان **تولیدکننده (generator)** که پاسخ‌ها را از کانتکست چندوجهیِ بازیابی‌شده ترکیب و سنتز می‌کند، و (۲) به عنوان **موتور نمایه‌سازی (indexing engine)** که اطلاعات ساختاریافته را در زمان ورود و پردازش داده (ingestion) استخراج می‌نماید.

### گزینه‌های VLM برای درک اسناد

در لبه فناوری (frontier)، خواندن نمودار، استخراج جدول و درک دیاگرام به اندازه‌ای به هم نزدیک هستند که رتبه‌بندی آن‌ها روی اسناد *شما* به ترکیب و تنوع صفحاتتان بستگی دارد. تفاوت‌هایی که تعیین‌کننده طراحی سیستم هستند عبارتند از قیمت، صورت‌حساب کانتکست‌های طولانی (long-context billing) و رفتار `API`:

| | Claude Opus 5.5 / Sonnet 5.5 | GPT-6 Astra / GPT-6 Sol | Gemini 3.8 Flash |
|---|---|---|---|
| **قیمت به ازای هر ۱ میلیون Token (ورودی / خروجی)** | ۴ دلار / ۲۰ دلار؛ ۲ دلار / ۱۰ دلار | ۱۰ دلار / ۵۰ دلار؛ ۲ دلار / ۱۰ دلار | ۰.۷۵ دلار / ۳.۷۵ دلار قیمت معرفی، ۱.۵۰ دلار / ۷.۵۰ دلار از ۱ ژانویه ۲۰۲۷ |
| **کانتکست** | ۱ میلیون، قیمت ثابت تا ۱ میلیون | ۱.۰۵ میلیون؛ بالاتر از 272K ورودی، کل درخواست با نرخ کانتکست طولانی محاسبه می‌شود | ۱٬۰۴۸٬۵۷۶ ورودی / ۶۵٬۵۳۶ خروجی |
| **خروجی ساختاریافته** | بومی نیتیو (`output_config.format`) | بومی نیتیو | بومی نیتیو |
| **نکات قابل توجه (Watch-outs)** | قابلیت تفکر (Thinking) همیشه فعال است (Opus 5.5) یا به طور پیش‌فرض فعال است (Sonnet 5.5)؛ بلوک متنی را تجزیه کنید، نه `content[0]` | شرکت OpenAI یک باگ انکودینگ تصویر را که باعث افت کیفیت درک تصویر در GPT-6 Sol و Luna شده بود در ۲۵ سپتامبر ۲۰۲۶ ذیل همان شناسه‌های مدل برطرف کرد: ارزیابی‌های تصویری پیش از این اصلاحیه را مجدداً اجرا کنید | قیمت تخفیفی معرفی در ۳۱ دسامبر پایان می‌یابد؛ بودجه‌بندی را بر اساس قیمت مصوب سال ۲۰۲۷ انجام دهید |

پارسرهای تخصصی اسناد (Cohere Parse، MinerU، jina-ocr-v1، Nemotron 3.5 Parse) اکنون فایل‌های Markdown را همراه با جداول، کادرهای احاطه‌کننده (bounding boxes) و ترتیب خوانش با کسری از هزینه VLMهای پیشرفته به ازای هر صفحه بازمی‌گردانند. برای مرحله استخراج در حجم بالا، ابتدا آن‌ها را مقایسه کنید؛ به [تحلیل چیدمان و OCR](../10-document-processing/01-ocr-and-layout.md) مراجعه فرمایید.

### خط لوله ورود داده تقویت‌شده با VLM

<div dir="ltr">

```
  Raw PDF
    |
    v
  Page Renderer (pdf2image, 300 DPI)
    |
    v
  VLM Extraction Pass:
    +-- "Extract all tables as markdown"
    +-- "Describe this chart: axes, trends, key data points"
    +-- "Summarize the diagram: components and relationships"
    |
    v
  Structured Output (JSON)
    |
    +---> Text chunks     --> Text embedding index
    +---> Table markdown  --> Text embedding index (with metadata: "type=table")
    +---> Chart summaries --> Text embedding index (with metadata: "type=chart")
    +---> Page images     --> Image embedding index (CLIP/SigLIP)
```

</div>

این رویکرد «توصیف و سپس امبدینگ» (describe-then-embed) محتوای بصری را به متن قابل جستجو تبدیل می‌کند و در عین حال تصویر اصلی را برای مرحله تولید نگه می‌دارد.

---

## مدل ColPali و بازیابی مبتنی بر بینایی

مدل ColPali نشان‌دهنده یک تغییر پارادایم است: به جای ساخت خطوط لوله پیچیده شامل استخراج جدول + تحلیل چیدمان + OCR، هر صفحه از سند را به عنوان یک تصویر واحد در نظر بگیرید و اجازه دهید یک مدل بینایی-زبان همه چیز را مدیریت کند.

### نحوه کار ColPali

```
  Document Page Image
        |
        v
  SigLIP Vision Encoder (So400m)
        |
  Splits image into patches (e.g., 32x32 grid = 1024 patches)
        |
        v
  Gemma 2B Language Model (contextualizes patch embeddings)
        |
        v
  Linear Projection --> 128-dim patch embeddings
        |
  Result: 1024 vectors of dim 128 per page
        |
        v
  Stored in Multi-Vector Index

  At query time:
  Query --> Tokenize --> Embed --> 128-dim token embeddings
        |
        v
  Late Interaction (MaxSim):
    Score = Sum over query tokens of Max similarity to any patch
```

### مقایسه ColPali در برابر خط لوله سنتی

| جنبه | خط لوله سنتی | ColPali |
|--------|---------------------|---------|
| **OCR** | الزامی (Tesseract، Azure OCR) | بدون نیاز |
| **تشخیص چیدمان (Layout Detection)** | الزامی (Detectron2، LayoutLM) | بدون نیاز |
| **پارسر جدول (Table Parser)** | الزامی (Camelot، Tabula) | بدون نیاز |
| **استخراج‌کننده نمودار (Chart Extractor)** | الزامی (ChartOCR) | بدون نیاز |
| **سرعت نمایه‌سازی** | کند (چندمرحله‌ای) | سریع (یک پاس رفت تک‌مرحله‌ای / single forward pass) |
| **کیفیت بازیابی** | روی متن بالا، روی عناصر بصری ضعیف | بالا در تمامی وجوه (modalities) |
| **فضای ذخیره‌سازی** | شاخص متنی (تقریباً کوچک) | شاخص چندبرداری (بزرگ‌تر) |

### خانواده ColPali

- **مدل ColPali (v1)**: ستون فقرات بر پایه PaliGemma-3B. نسخه اصلی و اولیه.
- **مدل‌های ColQwen2 / ColQwen2.5**: ستون فقرات بر پایه Qwen2-VL و Qwen2.5-VL. پشتیبانی چندزبانه بهتر، بهبودیافته روی اسناد زبان‌های آسیایی.
- **مدل ColSmol**: نسخه‌های کوچک‌تر برای استقرار (Deployment) در لبه (edge)، با کمتر از ۱ میلیارد پارامتر.

### نتایج بنچمارک ViDoRe

مدل ColPali در بنچمارک‌های پیچیده بصری نظیر InfographicVQA، ArxivQA و TabFQuAD که به ترتیب اینفوگرافیک‌ها، اشکال و جداول را می‌سنجند، بسیار درخشان عمل می‌کند. این مدل حتی روی اسناد متن‌محور نیز از خطوط لوله سنتی مبتنی بر متن پیشی می‌گیرد.

بنچمارک ViDoRe از آن زمان به نسخه ۳ (V3) منتقل شده است، و این همان نسخه‌ای است که توسعه‌دهندگان اکنون برای امبدرهای چندوجهی تک‌برداری به آن استناد می‌کنند (به جدول بالا مراجعه کنید). این موضوع در انتخاب معماری اهمیت زیادی دارد: سرویس‌دهی به یک امبدینگ تک‌برداری صفحه با نمره‌ای در حدود ۸۰ تا ۸۵ در ViDoRe V3 (گزارش‌شده توسط توسعه‌دهنده)، به مراتب ارزان‌تر از نگهداری ۱٬۰۲۴ بردار پَچ (patch vector) به ازای هر صفحه است؛ بنابراین، پیش از متعهد شدن به یک شاخص چندبرداری، ابتدا یک امبدر چندوجهی تک‌برداری را به همراه یک بازرتبه‌بند (reranker) آزمایش کنید.

---

## استخراج جدول و بازیابی داده‌های ساختاریافته

جدول‌ها دشوارترین مدالیته برای RAG سنتی هستند. مسطح‌سازی (Flattening) سطر به سطر یک جدول، روابط سرستون‌ها را که به هر سلول معنا می‌بخشند، از بین می‌برد.

### راهبرد ۱: استخراج مبتنی بر VLM

```python
# Pseudocode: Extract tables using a VLM
def extract_tables_from_page(page_image: bytes) -> list[dict]:
    prompt = """
    Extract ALL tables from this document page.
    For each table, return:
    {
      "title": "table title or caption",
      "headers": ["col1", "col2", ...],
      "rows": [["val1", "val2", ...], ...],
      "markdown": "| col1 | col2 |\\n|---|---|\\n| val1 | val2 |"
    }
    Return JSON array. If no tables, return [].
    """
    response = vlm.generate(image=page_image, prompt=prompt)
    return json.loads(response)
```

### راهبرد ۲: پارسرهای تخصصی جدول

- **ابزار Tabula / Camelot**: استخراج مبتنی بر قاعده (Rule-based) جدول از PDF. سریع اما در چیدمان‌های پیچیده شکننده است.
- **مدل Table Transformer (مبتنی بر DETR)**: مرزهای جدول و ساختار سلول‌ها را از تصاویر تشخیص می‌دهد.
- **کتابخانه Unstructured.io**: برای پارس کردن آگاه از چیدمان (Layout-aware)، روش‌های اکتشافی (Heuristics) را با مدل‌های یادگیری ماشین ترکیب می‌کند.
- **مدل‌های VLM پارس اسناد** (مانند Cohere Parse، MinerU 4.0، Docling با بک‌اند‌های VLM با قابلیت اتصال افزونه): جدول‌ها را به‌صورت درون‌خطی در قالب HTML یا Markdown همراه با کادرهای احاطه‌کننده (Bounding boxes) و ترتیب خواندن تولید می‌کنند که ارجاعات جدول به صفحه را دست‌نخورده نگه می‌دارد. به [OCR و تحلیل چیدمان](../10-document-processing/01-ocr-and-layout.md) مراجعه کنید.

### راهبرد ۳: Chunking آگاه از جدول

```
  Original Table (20 rows x 8 columns)
        |
        v
  Chunk as complete unit (do NOT split tables across chunks)
        |
        v
  Embed the full markdown table as a single chunk
        |
        v
  Add metadata: {"type": "table", "page": 14, "caption": "Q3 Revenue by Region"}
        |
        v
  At generation time: pass the FULL table to the LLM, not a fragment
```

**اصل کلیدی**: جدول‌ها باید واحدهای بازیابی اتمی (Atomic) باشند. هرگز یک جدول را در مرزهای Chunkها تقسیم نکنید.

---

## درک نمودار و دیاگرام

### انواع نمودار و رویکردهای استخراج

| نوع نمودار | چه چیزی استخراج شود | بهترین رویکرد |
|-----------|----------------|---------------|
| **میله‌ای/خطی/دایره‌ای (Bar/Line/Pie)** | مقادیر داده، روندها، مقایسه‌ها | توضیحات VLM + استخراج جدول داده‌ها |
| **فلوچارت (Flow Diagram)** | مراحل، تصمیم‌گیری‌ها، اتصالات | استخراج ساختاریافته VLM (گره‌ها + یال‌ها) |
| **دیاگرام معماری (Architecture Diagram)** | کامپوننت‌ها، روابط، جریان داده | توضیحات VLM + استخراج موجودیت (Entity) |
| **نمودار پراکندگی (Scatter Plot)** | همبستگی‌ها، داده‌های پرت (Outliers)، خوشه‌ها | توضیحات روند VLM + داده‌های خام در صورت وجود |
| **نمودار گانت (Gantt Chart)** | خط زمانی، وابستگی‌ها، مایلستون‌ها (نقاط عطف) | استخراج ساختاریافته VLM |

### راهبرد بازنمایی دوگانه (Dual-Representation)

برای هر نمودار یا دیاگرام، دو بازنمایی ذخیره کنید:

<div dir="ltr">

```
  Chart Image
    |
    +---> (1) Text Description (for text-based retrieval)
    |         "This bar chart shows Q3 revenue by region.
    |          North America: $4.2M, Europe: $3.1M, APAC: $2.8M.
    |          NA grew 15% QoQ while APAC declined 3%."
    |
    +---> (2) Original Image (for visual retrieval + generation context)
              Stored with CLIP/SigLIP embedding for image-based queries
```

</div>

این امر تضمین می‌کند که نمودار هم با پرس‌وجوهای متنی («درآمد APAC چقدر بود؟») و هم با پرس‌وجوهای بصری («نمودار درآمد را به من نشان بده») قابل بازیابی باشد.

---

## ویدیو: نمونه‌برداری ثابت در برابر پردازش مبتنی بر Agent (Agentic)

مدل‌های هزینه RAG ویدیو در گذشته محاسبات حسابی ساده‌ای بودند: مدت زمان ضربدر نرخ فریم ضربدر Tokenها به ازای هر فریم. پردازش ایستا و پیش‌فرض Gemini با نرخ 1 FPS نمونه‌برداری می‌کند و در وضوح رسانه‌ای پیش‌فرض (پایین) تقریباً ۱۰۰ Token در هر ثانیه ویدیو مصرف می‌کند؛ بنابراین یک ساعت ویدیو حدود ۳۶۰ هزار Token، یا حدود ۰.۲۷ دلار هزینه ورودی در Gemini 3.8 Flash با قیمت اولیه آن است (۰.۵۴ دلار بر اساس قیمت رسمی سال ۲۰۲۷). یک مدل با زمینه (Context) یک میلیونی تا حدود ۳ ساعت ویدیو را در وضوح پایین یا ۱ ساعت در وضوح بالا پردازش می‌کند.

در ۱ سپتامبر ۲۰۲۶، گوگل **پردازش ویدیوی مبتنی بر Agent (Agentic)** را به Gemini 3.7 Flash، 3.6 Flash و 3.5 Flash-Lite اضافه کرد، و مستندات اکنون Gemini 3.8 Flash را نیز فهرست می‌کنند: با تنظیم `"processing": "agentic"` روی ورودی ویدیو، مدل از ابزارهای ویدیویی داخلی برای تصمیم‌گیری درباره اینکه کدام بخش‌ها، با چه سرعتی و از طریق کدام مدالیته (فریم‌ها، صدا یا رونوشت متنی) بررسی شوند، استفاده می‌کند. این قابلیت اختیاری (Opt-in) است (نرخ ایستای 1 FPS همچنان پیش‌فرض باقی می‌ماند)، برای فایل‌های آپلودی و نشانی‌های اینترنتی یوتیوب کار می‌کند، و با قیمت‌های استاندارد Token بدون هیچ هزینه ویژگی اضافی محاسبه می‌شود. طبق گزارش گوگل، این قابلیت تا ۸۸٪ Tokenهای کمتر، تا ۶۶٪ هزینه پایین‌تر و تا ۷٪ دقت بالاتر در بنچمارک‌های استاندارد ویدیو ارائه می‌دهد که بیشترین دستاوردها روی ویدیوهای طولانی حاصل شده است (گزارش‌شده توسط ارائه‌دهنده).

<div dir="ltr">

```
STATIC (default):   video ──► every frame at 1 FPS + audio ──► context ──► answer
                    cost scales with duration

AGENTIC (opt-in):   video + question ──► model picks segments, speed, modality
                                         (frames / audio / transcript) ──► answer
                    cost scales with how much of the video the question needs
```

</div>

پیامدهای طراحی:
- **بودجه‌بندی بر اساس نوع سوال، نه بر اساس ساعت.** عبارت «در پایان چه اتفاقی می‌افتد؟» با بخش بسیار کمتری از ویدیو سروکار دارد تا «تمام موارد نقض ایمنی را فهرست کن». پیش از تعیین سهمیه‌ها (Quotas)، Tokenهای واقعی را به ازای هر دسته از پرس‌وجوها اندازه‌گیری کنید و انتظار داشته باشید که صرفه‌جویی تا سقف ۸۸ درصدی عمدتاً در ویدیوهای طولانی حاصل شود.
- **انتقال بازیابی به داخل مدل برای پرسش‌وپاسخ تک‌ویدیو.** پردازش مبتنی بر Agent (Agentic) در زمانی که سوال یک ویدیو را هدف قرار می‌دهد، جایگزین تشخیص صحنه، نمونه‌برداری از فریم‌های کلیدی و Chunking رونوشت متنی خود شما می‌شود. با این حال، جستجو در یک کتابخانه ویدیویی همچنان به یک ایندکس نیاز دارد: رونوشت‌ها و کپشن‌های صحنه در ایندکس متنی قرار می‌گیرند، کلیپ‌های کوتاه (تا ۱۲۰ ثانیه به ازای هر ورودی) با Gemini Embedding 2 امبد می‌شوند، و سپس ویدیوهای برتر به مدل تحویل داده می‌شوند.
- **پوشش (Coverage) را ارزیابی کنید، نه صرفاً دقت را.** از آنجا که مدل خودش انتخاب می‌کند چه چیزی را تماشا کند، درخواست ارجاعات دارای برچسب زمانی (Timestamped) داشته باشید و آن‌ها را در نمونه‌ای از پرس‌وجوها به‌صورت تصادفی با منبع تطبیق دهید؛ یک پاسخ بااطمینان که بر اساس بخش اشتباهی ساخته شده باشد، نسخه ویدیویی خطای عدم بازیابی (Retrieval miss) است.

---

## معماری محیط عملیاتی (Production)

### پایپ‌لاین کامل RAG چندوجهی (Multi-Modal)

<div dir="ltr">

```
  INGESTION:
  Raw Docs --> Doc Classifier --+--> Text-Heavy  --> chunking + text embeddings
                                +--> Visual-Heavy --> page render + ColPali
                                +--> Mixed        --> VLM extraction + hybrid
                                         |
                                         v
                          [Text Index] [Image Index] [Table Index]

  RETRIEVAL:
  Query --> Query Analyzer --+--> Text:  BM25 + dense search
                             +--> Image: CLIP/ColPali search
                             +--> Table: metadata-filtered dense
                                    |
                                    v
                             Cross-Modal Reranker --> Context Assembly --> VLM --> Response
```

</div>

### ملاحظات مقیاس‌پذیری

| دغدغه | راهکار |
|---------|----------|
| **اندازه ایندکس** | مدل ColPali حدود ۱۰۲۴ بردار به ازای هر صفحه ذخیره می‌کند. برای ۱ میلیون صفحه = حدود ۱ میلیارد بردار. از کوانتیزاسیون (باینری، PQ)، کدگذاری‌های تک‌برداری سبک MUVERA برای تولید کاندیدا (Milvus 3.0؛ Weaviate نسخه +1.31 با مسیر مبتنی بر دیسک HFresh اضافه‌شده در 1.40)، یا بردارهای کمتر در هر صفحه استفاده کنید (به [تعامل دیرهنگام (Late Interaction) و ColBERT](11-late-interaction-colbert.md#compressing-the-vectors-themselves) مراجعه کنید). |
| **تاخیر (Latency) ورود داده (Ingestion)** | استخراج با VLMهای پیشرو (Frontier) کند است (حدود ۲ تا ۵ ثانیه به ازای هر صفحه). پارسرهای تخصصی سریع‌تر هستند: jina-ocr-v1 روی یک پردازنده A100 در همروندی (Concurrency) ۳۲ با نرخ ۲.۵۷ صفحه در ثانیه اجرا می‌شود؛ Cohere رقم ۴.۵ صفحه در ثانیه به ازای هر GPU را برای Parse گزارش می‌دهد (هر دو گزارش‌شده توسط ارائه‌دهنده). از Workerهای ناهمگام (Async) استفاده کنید. |
| **تاخیر (Latency) پرس‌وجو** | انشعاب به چند ایندکس (Multi-index fan-out) تاخیر (Latency) ایجاد می‌کند. از بازیابی موازی + هرس تهاجمی top-k استفاده کنید. |
| **هزینه** | ورود داده (Ingestion) یک‌باره است؛ آن را روی حجم پرس‌وجوها سرشکن کنید. بر اساس قیمت‌های رسمی اکتبر ۲۰۲۶ با فرض حدود ۱.۷ هزار Token ورودی و ۸۰۰ Token خروجی به ازای هر صفحه: حدود ۰.۰۰۴ دلار به ازای هر صفحه در Gemini 3.8 Flash (قیمت اولیه)، حدود ۰.۰۱۱ دلار به ازای هر صفحه در Claude Sonnet 5.5 یا GPT-6 Sol، پیش از محاسبه Tokenهای استدلال؛ Batch APIها هر دو را نصف می‌کنند. قیمت Cohere Parse برابر ۱.۵۰ دلار به ازای هر ۱,۰۰۰ صفحه است. |
| **فضای ذخیره‌سازی** | تصاویر صفحات را در ذخیره‌ساز شیء (Object Storage مانند S3) ذخیره کنید. امبدینگ‌ها را در پایگاه داده برداری (Vector Database) ذخیره کنید. متن را در ایندکس جستجو ذخیره کنید. |

---

## نمونه پیاده‌سازی

### معماری RAG چندوجهی سرتاسری (End-to-End) با ColPali + VLM

```python
# Pseudocode: Production multi-modal RAG pipeline

import uuid
from colpali_engine import ColPali, ColPaliProcessor
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue
import anthropic

# --- INDEXING ---

def index_document(pdf_path: str, collection: str):
    """Index a PDF document using ColPali for visual retrieval
    and VLM extraction for text-based retrieval."""

    pages = render_pdf_to_images(pdf_path, dpi=300)

    colpali_model = ColPali.from_pretrained("vidore/colpali-v1.3")
    processor = ColPaliProcessor.from_pretrained("vidore/colpali-v1.3")
    vlm_client = anthropic.Anthropic()

    for page_num, page_image in enumerate(pages):
        # 1. Generate ColPali multi-vector embeddings
        inputs = processor(images=[page_image])
        patch_embeddings = colpali_model(**inputs)  # shape: [1, 1024, 128]

        # 2. Extract structured content via VLM
        extraction = vlm_client.messages.create(
            model="claude-sonnet-5-5",
            max_tokens=16000,                  # thinking is on by default; leave headroom
            output_config={"effort": "low"},   # transcription, not reasoning
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": encode_image(page_image)},
                    {"type": "text", "text": """Extract from this page:
                    1. All text content (preserve structure)
                    2. Tables as markdown
                    3. Chart descriptions with data points
                    Return as JSON with keys: text, tables, charts"""}
                ]
            }]
        )

        # Current Claude models return thinking blocks before the text block,
        # so content[0] is not the answer. Read the text block explicitly.
        text = next(b.text for b in extraction.content if b.type == "text")
        structured = json.loads(text)

        # 3. Store in vector DB
        qdrant.upsert(collection, points=[
            # ColPali multi-vector for visual retrieval
            PointStruct(
                id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"{pdf_path}#page={page_num}")),
                vector={"colpali": patch_embeddings[0].tolist()},
                payload={
                    "source": pdf_path,
                    "page": page_num,
                    "type": "page_image",
                    "text_preview": structured["text"][:500]
                }
            ),
            # Text embeddings for each extracted element
            *create_text_chunks(structured, pdf_path, page_num)
        ])


# --- RETRIEVAL ---

def retrieve(query: str, collection: str, top_k: int = 5):
    """Hybrid retrieval: ColPali visual + text semantic search."""

    # Visual retrieval via ColPali
    query_inputs = processor(text=[query])
    query_embeddings = colpali_model(**query_inputs)

    # query_points (Query API) replaces the legacy search endpoints,
    # which Qdrant 1.19 removed from its OpenAPI schema
    visual_results = qdrant.query_points(
        collection,
        query=query_embeddings[0].tolist(),  # multi-vector query, MaxSim scoring
        using="colpali",
        query_filter=Filter(must=[
            FieldCondition(key="type", match=MatchValue(value="page_image"))
        ]),
        limit=top_k,
    ).points

    # Text retrieval via dense embeddings
    text_embedding = text_encoder.encode(query)
    text_results = qdrant.query_points(
        collection,
        query=text_embedding.tolist(),
        using="text",
        limit=top_k,
    ).points

    # Fuse results using reciprocal rank fusion
    fused = reciprocal_rank_fusion(visual_results, text_results, k=60)
    return fused[:top_k]


# --- GENERATION ---

def generate_answer(query: str, retrieved_context: list) -> str:
    """Generate answer using VLM with multi-modal context."""

    content_blocks = [{"type": "text", "text": f"Question: {query}\n\nContext:"}]

    for ctx in retrieved_context:
        if ctx.payload["type"] == "page_image":
            # Include the actual page image
            content_blocks.append({
                "type": "image",
                "source": load_page_image(ctx.payload["source"], ctx.payload["page"])
            })
        else:
            # Include text/table content
            content_blocks.append({
                "type": "text",
                "text": f"[{ctx.payload['type']}] {ctx.payload['content']}"
            })

    content_blocks.append({
        "type": "text",
        "text": "Answer the question using ONLY the provided context. Cite sources."
    })

    response = vlm_client.messages.create(
        model="claude-sonnet-5-5",
        max_tokens=16000,
        output_config={"effort": "medium"},
        messages=[{"role": "user", "content": content_blocks}]
    )
    return next(b.text for b in response.content if b.type == "text")
```

---

## زاویه دید مصاحبه طراحی سیستم

### سوال: یک سیستم RAG برای یک پلتفرم تحقیقات مالی طراحی کنید که باید به سوالاتی درباره گزارش‌های درآمدی حاوی متن، جدول و نمودار پاسخ دهد.

**پاسخ قوی:**

چالش اصلی این است که بیش از ۶۰ درصد اطلاعات در گزارش‌های درآمدی در جدول‌ها و نمودارها قرار دارد، نه در متن ساده. یک پایپ‌لاین RAG صرفاً متنی، تفکیک‌های درآمدی، خطوط روند و داده‌های مقایسه‌ای را از دست خواهد داد.

**معماری**: من از یک رویکرد ترکیبی (الگوی ۲ + المان‌هایی از الگوی ۳) استفاده می‌کنم:

۱. **ورود داده (Ingestion)**: رندر کردن هر صفحه PDF با کیفیت 300 DPI. اجرای یک مرحله استخراج VLM برای تبدیل جدول‌ها به Markdown و نمودارها به توضیحات ساختاریافته. تولید هم‌زمان امبدینگ‌های چندبرداری ColPali برای تصویر هر صفحه.

۲. **ذخیره‌سازی**: سه ایندکس: (الف) Chunkهای متنی با امبدینگ‌های متراکم (متن مالی)، (ب) Markdown جدول با امبدینگ‌های متراکم به‌همراه فیلترهای فراداده (Metadata) برای نوع جدول، (ج) ایندکس چندبرداری ColPali برای بازیابی بصری در سطح صفحه.

۳. **بازیابی**: تحلیل‌گر پرس‌وجو نوع سوال را دسته‌بندی می‌کند. عبارت «درآمد فصل سوم (Q3) چقدر بود؟» جستجوی متنی + جدول را فعال می‌کند. عبارت «روند درآمد را به من نشان بده» جستجوی بصری (ColPali) را آغاز می‌نماید. نتایج از طریق RRF ادغام شده و توسط یک Reranker چندوجهی بازرتبه‌بندی (Rerank) می‌شوند (Qwen3-VL-Reranker-2B/8B گزینه وزن‌باز با مجوز Apache 2.0 و پنجره زمینه 32K است) تا تصاویر صفحات و متن جدول‌ها در یک مقیاس با هم رقابت کنند.

۴. **تولید**: یک VLM (مانند Claude یا Gemini) زمینه ادغام‌شده (Chunkهای متنی، Markdown جدول و تصاویر صفحات مرتبط) را دریافت می‌کند. سپس پاسخی مستند همراه با ارجاع به صفحات و جدول‌های خاص تولید می‌نماید.

**موازنه‌های کلیدی (Trade-offs)**: مدل ColPali پوشش و یادآوری (Recall) فوق‌العاده‌ای روی محتوای بصری فراهم می‌کند اما حدود ۱۰۲۴ بردار به ازای هر صفحه ذخیره می‌نماید؛ بنابراین برای ۱۰۰ هزار سند (۵۰۰ هزار صفحه)، این مقدار حدود ۵۰۰ میلیون بردار خواهد بود. من از کوانتیزاسیون باینری برای کاهش ۳۲ برابری فضای ذخیره‌سازی با پذیرش افت اندک در Recall استفاده می‌کنم، یا اگر پایگاه داده برداری (Vector Database) پشتیبانی کند، از روش تولید کاندیدای سبک MUVERA بهره می‌گیرم. پیش از تصمیم‌گیری نهایی درباره رویکرد چندبرداری، ابتدا یک امبدر چندوجهی تک‌برداری (مانند Cohere Embed 5 یا Gemini Embedding 2) به‌همراه Reranker را روی مجموعه ارزیابی (Eval set) خود آزمون A/B می‌کنم: ۵۰۰ هزار بردار به‌جای ۵۰۰ میلیون بردار. برای مسیر متنی، جستجوی ترکیبی متراکم + BM25 اصطلاحات مالی را به‌خوبی مدیریت می‌کند.

**هزینه ورود داده (Ingestion)** (قیمت‌های رسمی اکتبر ۲۰۲۶، حدود ۱.۷ هزار Token ورودی و ۸۰۰ Token خروجی به ازای هر صفحه): حدود ۲,۰۰۰ دلار برای ۵۰۰ هزار صفحه روی Gemini 3.8 Flash با قیمت اولیه آن، حدود ۵,۷۰۰ دلار روی Claude Sonnet 5.5 یا GPT-6 Sol پیش از محاسبه Tokenهای استدلال، یا ۷۵۰ دلار از طریق Cohere Parse با نرخ ۱.۵۰ دلار به ازای هر ۱,۰۰۰ صفحه. Batch APIها ارقام VLM را نصف می‌کنند. من صفحات را مسیریابی می‌کنم: استفاده از یک پارسر تخصصی برای صفحات حاوی متن و جدول، و استفاده از یک VLM پیشرو (Frontier) صرفاً برای صفحات پر از نمودار که توضیحات در آن‌ها اهمیت دارد.

### سوال: چگونه پرس‌وجویی را مدیریت می‌کنید که به اطلاعاتی هم از یک نمودار و هم از یک جدول در صفحات مختلف نیاز دارد؟

**پاسخ قوی:**

این مسئله، چالش بازیابی میان‌مدالیته‌ای (Cross-modal) و بین‌صفحه‌ای (Cross-page) است. راهکار شامل سه بخش است:

۱. **تنوع بازیابی (Retrieval diversity)**: اطمینان حاصل کنید که بازیاب، نتایجی از چندین مدالیته مختلف برمی‌گرداند. حداقل سهمیه‌ها را تعیین کنید: حداقل ۲ نتیجه متنی، ۲ نتیجه جدول، و ۱ نتیجه بصری در هر مجموعه بازیابی، صرف‌نظر از اینکه کدام مدالیته بالاترین امتیاز را کسب کرده باشد.

۲. **ترکیب زمینه (Context assembly)**: هنگام مونتاژ Prompt مدل VLM، تمام محتوای بازیابی‌شده را همراه با منشأ صریح و مشخص بگنجانید: «[جدول از صفحه ۱۴: درآمد فصل سوم بر اساس منطقه]» و «[نمودار از صفحه ۲۲: روند درآمد ۲۰۲۴-۲۰۲۶]». سپس VLM می‌تواند در سراسر هر دو منبع استدلال کند.

۳. **پشتیبان مبتنی بر Agent (Agentic fallback)**: اگر بازیابی اولیه زمینه میان‌مدالیته‌ای کافی ارائه ندهد، یک لایه Agentic می‌تواند بازیابی‌های بعدی را صادر کند: «جدول ارقام درآمد را نشان می‌دهد اما کاربر درباره روندها پرسیده است، بنابراین اجازه دهید نمودارهای مربوط به درآمد را نیز جستجو کنم».

بینش کلیدی این است که پرسش‌های میان‌مدالیته‌ای ذاتاً چندمرحله‌ای (Multi-hop) هستند. سیستم باید از یک مدالیته بازیابی را انجام دهد، شکاف اطلاعاتی را تشخیص دهد، و از مدالیته دیگری بازیابی کند.

### سوال: کاربران می‌خواهند از میان یک کتابخانه ۱۰,۰۰۰ ساعتی از ویدیوهای آموزشی سوال بپرسند. چگونه آن را طراحی می‌کنید و هزینه‌اش را برآورد می‌نمایید؟

**پاسخ قوی:**

جستجوی کتابخانه را از درک تک‌ویدیو تفکیک کنید، زیرا تنها مورد دوم می‌تواند از ابزارهای ویدیویی خود مدل استفاده کند.

۱. **یک‌بار ایندکس کنید.** پردازش تمام ویدیوها به ازای هر سوال منتفی است: با مصرف تقریبی ۱۰۰ Token در ثانیه، کل کتابخانه برای هر پیمایش کامل حدود ۳.۶ میلیارد Token خواهد بود. در عوض، یک‌بار پیاده‌سازی صوتی (Transcribe) انجام دهید (حدود ۲,۷۰۰ دلار برای ۶۰۰,۰۰۰ دقیقه با نرخ ۰.۰۰۴۵ دلار در هر دقیقه در `gpt-transcribe`)، رونوشت‌های متنی و کپشن‌های صحنه را در یک ایندکس ترکیبی BM25 + متراکم قرار دهید، و کلیپ‌های کوتاه (تا ۱۲۰ ثانیه به ازای هر ورودی) را با Gemini Embedding 2 برای پرس‌وجوهای بصری امبد کنید.
۲. **ابتدا بازیابی کنید، سپس تماشا کنید.** بازیابی، ویدیوهای برتر را همراه با برچسب‌های زمانی بازمی‌گرداند. تنها همین ویدیوها به Gemini 3.8 Flash ارسال می‌شوند. یک ساعت کامل با نرخ ایستای 1 FPS حدود ۳۶۰ هزار Token است (حدود ۰.۲۷ دلار هزینه ورودی با قیمت اولیه)؛ با تنظیم `"processing": "agentic"` مدل خودش تصمیم می‌گیرد کدام بخش‌ها را بررسی کند، و طبق گزارش گوگل تا ۸۸٪ Tokenهای کمتر در ویدیوهای طولانی مصرف می‌شود (گزارش‌شده توسط ارائه‌دهنده).
۳. **محاسبه هزینه بر اساس دسته پرس‌وجو.** میزان مصرف Token در پردازش Agentic به سوال بستگی دارد، بنابراین من در یک طرح آزمایشی (Pilot) آن را بر اساس نوع پرس‌وجو اندازه‌گیری کرده و سهمیه‌ها را بر اساس توزیع اندازه‌گیری‌شده تعیین می‌کنم، نه بر اساس مدت زمان ویدیو.
۴. **مستندسازی (Grounding) را ارزیابی کنید.** ارجاعات دارای برچسب زمانی را الزامی کنید و آن‌ها را به‌صورت تصادفی بررسی نمایید، زیرا حالت شکست در اینجا، یک پاسخ روان اما برگرفته از بخش اشتباهی از ویدیو است.

---

## مراجع

- Faysse et al. "ColPali: Efficient Document Retrieval with Vision Language Models" (ICLR 2025)
- Google. "SigLIP 2: Multilingual Vision-Language Encoders" (2025)
- NVIDIA. "An Easy Introduction to Multimodal Retrieval-Augmented Generation" (2025)
- HKUDS. "RAG-Anything: All-in-One Multimodal RAG Framework" (2025)
- وبلاگ Vespa. "PDF Retrieval with Vision Language Models" (2024)
- گوگل. "Gemini Embedding 2" (مارس ۲۰۲۶) و "Introducing agentic video in Gemini" (سپتامبر ۲۰۲۶)
- گوگل. مستندات درک ویدیوی Gemini API (دسترسی در اکتبر ۲۰۲۶)
- شرکت Cohere. "Embed 5" (سپتامبر ۲۰۲۶)

---

*قبلی: [تعامل دیرهنگام (Late Interaction) و ColBERT](11-late-interaction-colbert.md) | بعدی: [الگوهای ارزیابی RAG](13-rag-evaluation-patterns.md)*

</div>
