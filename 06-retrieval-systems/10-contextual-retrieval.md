<div dir="rtl">

# بازیابی بافتاری (Contextual Retrieval)

بازیابی بافتاری (Contextual Retrieval) یک تکنیک زمان بارگذاری داده‌ها (ingestion-time) است که علت شماره یک شکست RAG را برطرف می‌کند: **چانک‌هایی که هنگام جدا شدن از سند منبع خود، معنایشان را از دست می‌دهند**. این روش که در اواخر سال ۲۰۲۴ توسط Anthropic پیشگام شد، اکنون به یک استاندارد در محیط عملیاتی برای بازیابی با دقت بالا تبدیل شده است. سنجش‌های اختصاصی Anthropic نشان‌دهنده کاهش ۴۹ درصدی در شکست‌های بازیابی ۲۰ نتیجه برتر با استفاده از تعبیه‌های بافتاری (Contextual Embeddings) به همراه BM25 بافتاری، و کاهش ۶۷ درصدی در صورت افزودن بازرتبه‌بندی (Reranking) است.

## فهرست مطالب

- [مسئله: رقیق‌سازی بافتار (Context Dilution)](#the-problem-context-dilution)
- [نحوه کارکرد بازیابی بافتاری](#how-contextual-retrieval-works)
- [تعبیه‌های بافتاری (Contextual Embeddings)](#contextual-embeddings)
- [الگوریتم BM25 بافتاری (Contextual BM25)](#contextual-bm25)
- [پایپ‌لاین کامل: ترکیبی + بازرتبه‌بندی](#the-full-pipeline-hybrid--reranking)
- [الگوهای پیاده‌سازی](#implementation-patterns)
- [ملاحظات هزینه](#cost-considerations)
- [بازیابی بافتاری در مقایسه با سایر رویکردها](#contextual-retrieval-vs-other-approaches)
- [معماری محیط عملیاتی](#production-architecture)
- [سوالات مصاحبه](#interview-questions)
- [منابع](#references)

---

## مسئله: رقیق‌سازی بافتار (Context Dilution)

هنگامی که اسناد را برای RAG قطعه‌بندی (Chunking) می‌کنیم، چانک‌های منفرد، بافتار پیرامونی را که به آن‌ها معنا می‌بخشد از دست می‌دهند.

**نمونه‌ای از رقیق‌سازی بافتار (Context Dilution):**

```
Original Document: "Acme Corp Q3 2025 Financial Report"
  Section 4: Product Pricing

  "The Standard plan costs $200/month. The Enterprise
   plan includes SSO and audit logs for $800/month."

-------- After Chunking --------

Chunk 17: "It costs $200/month."
Chunk 18: "The Enterprise plan includes SSO and audit
           logs for $800/month."
```

**مشکل چانک ۱۷ (Chunk 17)**: کاربری که عبارت "How much does Acme Standard plan cost?" (هزینه طرح استاندارد Acme چقدر است؟) را جستجو می‌کند، احتمالاً این چانک را از دست خواهد داد؛ زیرا در آن هیچ اشاره‌ای به "Acme"، "Standard" یا "plan" نشده است. تعبیه عبارت "It costs $200/month" از نظر معنایی با پرس‌وجو (Query) فاصله دارد.

**بینش کلیدی**: تحقیقات Anthropic نشان داد که Chunking سنتی باعث **نرخ شکست بازیابی ۵.۷ درصدی** در ۲۰ چانک برتر بازیابی‌شده می‌شود. این بدان معناست که تقریباً از هر ۱۸ پرس‌وجو، ۱ پرس‌وجو در بازیابی اطلاعات مرتبط ناموفق است، حتی با وجود اینکه آن اطلاعات در پایگاه دانش وجود دارد.

---

## نحوه کارکرد بازیابی بافتاری (Contextual Retrieval)

ایده اصلی ساده است: **پیش از تعبیه کردن یک چانک، یک رشته بافتار کوتاه را به ابتدای آن اضافه کنید که توضیح می‌دهد این چانک در کل سند درباره چیست**.

<div dir="ltr">

```
┌──────────────────────────────────────────────────┐
│              TRADITIONAL CHUNKING                │
│                                                  │
│  Document ──► Split ──► Chunks ──► Embed ──► DB  │
│                                                  │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│              CONTEXTUAL RETRIEVAL                            │
│                                                              │
│  Document ──► Split ──► Chunks ──┐                           │
│                                  ├──► Contextualize ──►      │
│  Document (full) ───────────────┘    (LLM call per chunk)    │
│                                                              │
│  ──► Contextual Chunks ──► Embed ──► DB                      │
│                            + BM25 Index                      │
└──────────────────────────────────────────────────────────────┘
```

</div>

**مرحله بافتاربخشی (Contextualization)** کل سند + چانک منفرد را به همراه این Prompt به یک LLM ارسال می‌کند:

```
<document>
{{WHOLE_DOCUMENT}}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{{CHUNK_CONTENT}}
</chunk>

Please give a short succinct context to situate this chunk
within the overall document for the purposes of improving
search retrieval of the chunk. Answer only with the succinct
context and nothing else.
```

**نتیجه برای چانک ۱۷ (Chunk 17)**:

```
Before: "It costs $200/month."

After:  "This chunk is from the Acme Corp Q3 2025 Financial
         Report, Section 4 on Product Pricing. It describes
         the cost of the Standard plan.
         It costs $200/month."
```

اکنون تعبیه این چانک شامل "Acme" ،"Standard plan" و "Product Pricing" است: تمام اصطلاحاتی که یک کاربر به طور طبیعی جستجو می‌کند.

---

## تعبیه‌های بافتاری (Contextual Embeddings)

تعبیه‌های بافتاری (Contextual Embeddings) نخستین زیرتکنیک است: تعبیه کردن چانک بافتاربخشی‌شده به جای چانک خام.

### نحوه بهبود بازیابی

| سناریو | تعبیه چانک خام | تعبیه بافتاری (Contextual Embedding) |
|---|---|---|
| کاربر درباره "Acme pricing" سوال می‌کند | "It costs $200" را پیدا نمی‌کند | با "Acme...Standard plan...costs $200" مطابقت می‌یابد |
| کاربر درباره "SSO features" سوال می‌کند | با "SSO and audit logs" مطابقت می‌یابد | با بافتار افزوده‌شده‌ی "Enterprise plan" مطابقت می‌یابد |
| کاربر درباره "Q3 financials" سوال می‌کند | تطابقی ندارد (هیچ اشاره‌ای به Q3 نشده است) | از طریق عبارت پیش‌افزوده "Q3 2025 Financial Report" تطابق می‌یابد |

**عملکرد**: تعبیه‌های بافتاری (Contextual Embeddings) به تنهایی نرخ شکست بازیابی ۲۰ نتیجه برتر را از **۵.۷٪ به ۳.۷٪** کاهش می‌دهند که معادل **۳۵٪ کاهش** در خطاهای بازیابی است.

### جابه‌جایی در فضای برداری (Vector Space Shift)

<div dir="ltr">

```
                    ▲ Dimension 2
                    │
                    │    ● "Acme pricing" (query)
                    │         \
                    │          \  close (contextual)
                    │           \
                    │            ● Contextualized chunk
                    │
                    │                          ● Raw chunk "It costs $200"
                    │                            (far from query)
                    │
                    └─────────────────────────────► Dimension 1
```

</div>

---

## الگوریتم BM25 بافتاری (Contextual BM25)

زیرتکنیک دوم، همان فرآیند بافتاربخشی را برای ایجاد یک **نمایه کلیدواژه‌ای BM25** بر روی چانک‌های غنی‌شده اعمال می‌کند.

### چرا BM25 همچنان اهمیت دارد

تعبیه‌های متراکم (Dense embeddings) در شباهت معنایی عالی عمل می‌کنند اما در موارد زیر ناموفق هستند:
- **اصطلاحات دقیق**: شناسه‌های محصول، شماره نسخه‌ها، کلمات اختصاری
- **Tokenهای نادر**: اصطلاحات تخصصی دامنه که مدل‌های تعبیه بازنمایی ضعیفی از آن‌ها دارند
- **اسامی خاص**: نام شرکت‌ها، افراد، مکان‌ها

**مثال**: کاربری که عبارت "Widget-X pricing" را جستجو می‌کند، بر روی چانک خام "It costs $200/month" صفر تطابق BM25 دریافت می‌کند زیرا "Widget-X" هرگز در آن دیده نمی‌شود. با BM25 بافتاری، بافتار پیش‌افزوده شامل "Widget-X" به عنوان یک کلمه کلیدی است که تطابق BM25 را ممکن می‌سازد.

### بهبودهای عملکرد (تجمعی)

| پیکربندی | نرخ شکست | کاهش نسبت به خط پایه (Baseline) |
|---|---|---|
| تعبیه‌های سنتی (خط پایه) | ۵.۷٪ | -- |
| فقط تعبیه‌های بافتاری (Contextual Embeddings) | ۳.۷٪ | ۳۵٪ |
| تعبیه‌های بافتاری + BM25 بافتاری | ۲.۹٪ | **۴۹٪** |
| تعبیه‌های بافتاری + BM25 بافتاری + بازرتبه‌بندی (Reranking) | ۱.۹٪ | **۶۷٪** |

**نکته کلیدی**: ترکیب تعبیه‌های بافتاری + BM25 بافتاری پربازده‌ترین تغییر واحدی است که می‌توانید در یک پایپ‌لاین RAG اعمال کنید. افزودن یک بازرتبه‌بند (Reranker) بر روی آن، شکست‌ها را تا ۶۷٪ کاهش می‌دهد.

---

## پایپ‌لاین کامل: ترکیبی + بازرتبه‌بندی

پایپ‌لاین بازیابی بافتاری در رده عملیاتی دارای چهار مرحله است:

<div dir="ltr">

```
┌─────────────────────────────────────────────────────────────────┐
│                     INGESTION PIPELINE                          │
│                                                                 │
│  1. Chunk documents (recursive, 300-500 tokens)                 │
│  2. For each chunk:                                             │
│     a. Send (full_doc + chunk) to LLM                           │
│     b. Get context string (50-100 tokens)                       │
│     c. Prepend context to chunk                                 │
│  3. Embed contextualized chunks ──► Vector DB                   │
│  4. Index contextualized chunks ──► BM25 Index                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     QUERY PIPELINE                              │
│                                                                 │
│  User Query                                                     │
│      │                                                          │
│      ├──► Vector Search (Top 50) ──┐                            │
│      │                             ├──► RRF Fusion (Top 25)     │
│      └──► BM25 Search (Top 50)  ──┘         │                   │
│                                             ▼                   │
│                                      Reranker (Top 5)           │
│                                             │                   │
│                                             ▼                   │
│                                     LLM Generation              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

</div>

### ترکیب نتایج به روش ادغام رتبه متقابل (RRF)

همان تکنیک RRF که در جستجوی ترکیبی استاندارد استفاده می‌شود، در اینجا نیز کاربرد دارد:

```
RRF_Score(doc) = sum( 1 / (k + rank_in_list) )
                 for each list where doc appears

k = 60 (standard smoothing constant)
```

---

## الگوهای پیاده‌سازی

### الگوی ۱: بازیابی بافتاری پایه‌ای (Python)

```python
import anthropic
from typing import List

client = anthropic.Anthropic()

CONTEXT_PROMPT = """<document>
{document}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{chunk}
</chunk>

Please give a short succinct context to situate this chunk
within the overall document for the purposes of improving
search retrieval of the chunk. Answer only with the succinct
context and nothing else."""


def contextualize_chunk(
    full_document: str,
    chunk: str,
    model: str = "claude-haiku-5-5"  # small model: context strings are short and factual
) -> str:
    """Generate context for a single chunk."""
    response = client.messages.create(
        model=model,
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": CONTEXT_PROMPT.format(
                document=full_document,
                chunk=chunk
            )
        }]
    )
    # Read the text block, not content[0]: on models that think by default
    # (Haiku 5.5, Sonnet 5.5, Opus 5.5), a thinking block can come first.
    context = next(b.text for b in response.content if b.type == "text")
    return f"{context}\n\n{chunk}"


def process_document(document: str, chunks: List[str]) -> List[str]:
    """Contextualize all chunks in a document."""
    contextualized = []
    for chunk in chunks:
        ctx_chunk = contextualize_chunk(document, chunk)
        contextualized.append(ctx_chunk)
    return contextualized
```

### الگوی ۲: بهینه‌سازی هزینه با Prompt Caching

بزرگ‌ترین محرک هزینه، ارسال کل سند همراه با هر چانک است. قابلیت **Prompt Caching** این مسئله را حل می‌کند:

```python
def contextualize_with_caching(
    full_document: str,
    chunks: List[str],
    model: str = "claude-haiku-5-5"
) -> List[str]:
    """
    Use prompt caching so the full document is only
    processed once across all chunks.
    """
    results = []

    for chunk in chunks:
        response = client.messages.create(
            model=model,
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"<document>\n{full_document}\n</document>",
                        "cache_control": {"type": "ephemeral"}
                    },
                    {
                        "type": "text",
                        "text": (
                            f"<chunk>\n{chunk}\n</chunk>\n\n"
                            "Please give a short succinct context to "
                            "situate this chunk within the overall "
                            "document for the purposes of improving "
                            "search retrieval of the chunk. Answer "
                            "only with the succinct context and "
                            "nothing else."
                        )
                    }
                ]
            }]
        )
        context = next(b.text for b in response.content if b.type == "text")
        results.append(f"{context}\n\n{chunk}")

    return results
```

**اثر هزینه‌ای Prompt Caching**: برای یک سند ۱۰,۰۰۰ Token که به ۳۰ چانک تقسیم شده است، Prompt Caching هزینه ورودی سند را تقریباً **۸۵٪** کاهش می‌دهد: یک عملیات نوشتن در کش با نرخ ۱.۲۵ برابر قیمت ورودی، و سپس ۲۹ بار خواندن با نرخ ۰.۱ برابر، به جای ۳۰ بار خواندن با قیمت کامل.

سه تله عملیاتی می‌توانند این صرفه‌جویی را از بین ببرند:
- **تداخل و انتشار موازی سرد (Interleaving and cold fan-out):** مدت‌زمان پیش‌فرض ماندگاری کش (TTL) برابر با ۵ دقیقه است. تمام چانک‌های یک سند را در این پنجره زمانی زمان‌بندی کنید؛ صفی که چانک‌های یک سند را طی چند ساعت پخش می‌کند، هر فراخوانی را به یک عملیات نوشتن در کش تبدیل خواهد کرد. فراخوانی اول را به تنهایی ارسال کنید و پس از بازگشت آن، بقیه را به صورت توزیع موازی (fan out) بفرستید: فراخوانی‌های همزمان اولیه همگی کش را از دست می‌دهند (Cache Miss) و همگی هزینه نوشتن را متحمل می‌شوند.
- **اسناد کوتاه:** حداقل پیشوند قابل کش شدن به مدل بستگی دارد: در Claude Haiku 5.5، Sonnet 5.5، Opus 5.5 و Fable 5.1 برابر با ۵۱۲ Token است، اما در Claude Haiku 4.5 برابر با ۴,۰۹۶ Token است. یک سند ۳,۰۰۰ Token در Haiku 4.5 به صورت نامحسوس هرگز کش نمی‌شود؛ به جای فرض کردن، `usage.cache_read_input_tokens` را بررسی کنید.
- **اسناد طولانی در Haiku 5.5:** قیمت ۰.۱۰ / ۰.۵۰ دلاری آن تنها تا زمانی برقرار است که کل Prompt، با احتساب سند کش‌شده، کمتر یا مساوی ۱۰۰ هزار Token باشد. بالاتر از این مقدار، کل درخواست با نرخ ۰.۵۰ / ۲.۵۰ دلار محاسبه می‌شود، بنابراین یک قرارداد ۱۵۰ هزار Token هزینه تک‌تک فراخوانی‌های چانک خود را ۵ برابر می‌کند. اسناد بسیار طولانی را به بخش‌هایی زیر این مرز تقسیم کنید، یا سطح قیمتی بالاتر را در بودجه در نظر بگیرید (که همچنان نصف قیمت رسمی Haiku 4.5 است).
- **شناسه‌های مدل منسوخ‌شده (Retired model IDs):** شناسه‌های تاریخ‌دار مدل منسوخ می‌شوند: مدل `claude-sonnet-4-20250514` در ۱۵ ژوئن ۲۰۲۶ از Claude API کنار گذاشته شد و هر پایپ‌لاینی را که این شناسه را به صورت هاردکد داشت از کار انداخت. شناسه مدل را در پیکربندی (Config) نگه‌داری کنید نه در کد، و آن را در کنار هر رشته بافتار تولیدشده ذخیره نمایید.

### الگوی ۳: هدرهای بافتاری چانک (جایگزین سبک‌وزن)

اگر بافتاربخشی مبتنی بر LLM بسیار گران است، از **هدرهای بافتاری چانک (Contextual Chunk Headers - CCH)** به عنوان یک جایگزین قطعی (Deterministic) استفاده کنید:

```python
def add_chunk_headers(
    document_title: str,
    section_hierarchy: List[str],
    chunk: str
) -> str:
    """
    Prepend document and section metadata to the chunk.
    No LLM call required: purely structural.
    """
    header_parts = [f"Document: {document_title}"]

    for i, section in enumerate(section_hierarchy):
        prefix = "  " * i
        header_parts.append(f"{prefix}Section: {section}")

    header = "\n".join(header_parts)
    return f"{header}\n\n{chunk}"


# Example usage:
contextualized = add_chunk_headers(
    document_title="Acme Corp Q3 2025 Financial Report",
    section_hierarchy=["Finance", "Product Pricing", "Standard Plan"],
    chunk="It costs $200/month."
)

# Result:
# Document: Acme Corp Q3 2025 Financial Report
#   Section: Finance
#     Section: Product Pricing
#       Section: Standard Plan
#
# It costs $200/month.
```

**چه زمانی از CCH در مقایسه با بافتاربخشی با LLM استفاده کنیم:**

| فاکتور | هدرهای چانک (CCH) | بافتاربخشی با LLM |
|---|---|---|
| **هزینه** | رایگان (بدون فراخوانی LLM) | حدود ۰.۵۰ دلار (GPT-6 Luna یا Claude Haiku 5.5، پیش از Tokenهای تفکر) تا ۵ دلار (Claude Haiku 4.5) به ازای هر ۱ میلیون Token سند همراه با کش |
| **کیفیت** | خوب برای اسناد ساختاریافته | عالی برای تمام اسناد |
| **سرعت** | آنی | ۰.۵ تا ۲ ثانیه در هر فراخوانی؛ توان عملیاتی (Throughput) از طریق همزمانی به دست می‌آید |
| **بهترین کاربرد** | اسناد Markdown، HTML و PDF با هدرهای واضح | متن‌های بدون ساختار، اسناد حقوقی، اسناد پزشکی |

---

## ملاحظات هزینه

### هزینه‌های بافتاربخشی

برای یک پایگاه دانش با ۱۰,۰۰۰ چانک (هر کدام ۴۰۰ Token) برگرفته از ۵۰۰ سند با ۸,۰۰۰ Token، در صورتی که سند کش شده باشد و حدود ۵۰۰ Token ورودی Prompt بدون کش و ۷۵ Token خروجی در هر فراخوانی وجود داشته باشد، با قیمت‌های رسمی در ۲ نوامبر ۲۰۲۶:

| گزینه | قیمت به ازای ۱ میلیون (ورودی / خواندن از کش / خروجی) | هزینه هر چانک | هزینه کل | توضیحات |
|---|---|---|---|---|
| **GPT-6 Luna** | ۰.۱۰ / ۰.۰۱ / ۰.۵۰ دلار | حدود ۰.۰۰۰۲ دلار | حدود ۲ دلار | شرکت OpenAI به طور خودکار کش می‌کند؛ ۱.۲۵ برابر نوشتن روی کش ۳۰ دقیقه‌ای، ۲.۵ برابر روی گزینه ۱۲ ساعته |
| **Claude Haiku 5.5** | ۰.۱۰ / ۰.۰۱ / ۰.۵۰ دلار (Promptهای تا ۱۰۰ هزار Token) | حدود ۰.۰۰۰۲ دلار | حدود ۲ تا ۳ دلار + تفکر | تفکر تطبیقی (Adaptive thinking) به طور پیش‌فرض فعال است (تلاش `medium`)، بنابراین تلاش را پایین تنظیم کنید؛ Tokenizer آن حدود ۳۰٪ Tokenهای بیشتری نسبت به Haiku 4.5 برای متن مشابه شمارش می‌کند (نزدیک به ۳ دلار در انتهای بازه)؛ حداقل پیشوند قابل کش شدن ۵۱۲ Token است |
| **Claude Haiku 4.5** | ۱ / ۰.۱۰ / ۵ دلار | حدود ۰.۰۰۲ دلار | حدود ۲۱ دلار | تفکر به طور پیش‌فرض ندارد؛ حداقل پیشوند قابل کش شدن ۴,۰۹۶ Token است |
| **Claude Sonnet 5.5** | ۲ / ۰.۱۰ / ۱۰ دلار | حدود ۰.۰۰۳ دلار | حدود ۳۶ دلار + تفکر | تفکر به طور پیش‌فرض فعال است؛ برای این کار `thinking: {type: "between_tools"}` یا تلاش کم ارسال کنید |
| **Claude Opus 5.5** | ۴ / ۰.۲۰ / ۲۰ دلار | حدود ۰.۰۰۷ دلار | حدود ۷۰ دلار + تفکر | تفکر غیرفعال نمی‌شود؛ برای این کار زیاده‌روی است |
| **voyage-context-4** (بدون فراخوانی LLM) | ۰.۱۲ دلار تعبیه | حدود ۰.۰۰۰۰۵ دلار | حدود ۰.۵۰ دلار | جایگزین مرحله تعبیه می‌شود؛ فقط به بازیابی متراکم کمک می‌کند (به زیر مراجعه کنید) |

**بهترین شیوه (Best practice)**: از یک مدل کوچک برای بافتاربخشی استفاده کنید. رشته‌های بافتار کوتاه و مبتنی بر واقعیت هستند، بنابراین یک مدل پیشرو هزینه اضافه ایجاد می‌کند و در جدیدترین مدل‌های Claude، Tokenهای استدلال (که به طور پیش‌فرض فعال هستند و در Opus 5.5 غیرقابل غیرفعال‌سازی می‌باشند) را بدون افزایش قابل اندازه‌گیری کیفیت تحمیل می‌کند. آن را با Prompt Caching ترکیب کنید و در صورتی که امکان انتظار وجود دارد، بارگذاری‌های گذشته‌نگر (Backfills) را از طریق یک Batch API (با ۵۰٪ تخفیف نسبت به لیست قیمت هم در Anthropic و هم در OpenAI) اجرا کنید.

مدل Claude Haiku 5.5 (عرضه عمومی در ۷ اکتبر ۲۰۲۶) گزینه پیش‌فرض برای این کار در Claude است: یک‌دهم قیمت Haiku 4.5 برای Promptهای تا ۱۰۰ هزار Token، و با همان قیمت رسمی GPT-6 Luna. این یک جایگزینی بی‌دردسر و مستقیم نیست؛ پارامترهای `temperature`، `top_p`، `top_k`، `budget_tokens` و پیش‌پر کردن پاسخ دستیار (assistant prefill) همگی خطای 400 برمی‌گردانند، تغییر Tokenizer تمامی شمارش‌های Token را که بودجه‌بندی کرده بودید جابه‌جا می‌کند، و رشته‌های بافتاری که می‌نویسد با Haiku 4.5 متفاوت خواهد بود، بنابراین پیش از بافتاربخشی مجدد یک مجموعه اسناد، مجموعه طلایی بازیابی (retrieval golden set) را دوباره اجرا کنید. Haiku 4.5 همچنان روی Claude API وضعیت فعال (Active) دارد و هیچ اطلاعیه منسوخ‌شدنی ندارد (Anthropic حداقل مهلت ۶۰ روزه می‌دهد، بنابراین قبل از حدود ژانویه ۲۰۲۷ نخواهد بود)، در حالی که Microsoft Foundry تاریخ ۱۵ نوامبر ۲۰۲۶ را برای آن ثبت کرده است. با بافتاربخش به عنوان یک وابستگی قابل تعویض برخورد کنید و شناسه مدل را در کنار هر رشته بافتار ذخیره نمایید.

### چه زمانی از بازیابی بافتاری استفاده کنیم

**در این موارد استفاده کنید:**
- مجموعه اسناد شما دارای اسناد تکه‌تکه‌ای است که در آن‌ها چانک‌ها در حالت مجزا معنایشان را از دست می‌دهند
- اصطلاحات تخصصی دامنه دارید که مدل‌های تعبیه با آن‌ها مشکل دارند
- نرخ شکست بازیابی شما از ۳ تا ۵ درصد فراتر می‌رود
- توانایی پرداخت هزینه یک‌باره مرحله بارگذاری و ورود داده (Ingestion) را دارید

**در این موارد صرف‌نظر کنید:**
- چانک‌های شما از قبل خودکفا هستند (مانند جفت‌های پرسش و پاسخ، توضیحات محصول)
- مجموعه اسناد شما بسیار کوچک است (کمتر از ۱۰۰ چانک)؛ به جای آن صرفاً از بافتار طولانی (Long context) استفاده کنید
- به بارگذاری بلادرنگ (کمتر از ۱ ثانیه برای هر سند) نیاز دارید و نمی‌توانید پردازش دسته‌ای انجام دهید

---

## مقایسه بازیابی زمینه‌ای (Contextual Retrieval) با سایر رویکردها

| رویکرد | نحوه کارکرد | بهبود بازیابی | هزینه | پیچیدگی |
|----------|-------------|----------------------|------|------------|
| **Chunking ساده (Naive Chunking)** | تقسیم با اندازه ثابت، تولید Embedding خام | خط پایه (Baseline) | ندارد | پایین |
| **سرآیندهای Chunk یا CCH (Chunk Headers)** | افزودن عناوین سند/بخش به ابتدا | ۱۰-۲۰٪ | ندارد | پایین |
| **بازیابی زمینه‌ای (Contextual Retrieval)** | تولید زمینه (Context) توسط LLM برای هر Chunk | ۳۵-۴۹٪ | حدود ۲ تا ۴۵ دلار به ازای هر ۱۰ هزار Chunk (مدل کوچک تا متوسط) | متوسط |
| **بازیابی زمینه‌ای + بازرتبه‌بندی (Reranking)** | موارد بالا + بازرتبه‌بندی با Cross-Encoder | ۶۷٪ | موارد بالا، به‌علاوه هزینه بازرتبه‌بندی به ازای هر Query | متوسط تا بالا |
| **Embeddingهای زمینه‌ای Chunk (Contextual chunk embeddings)** | مدل Embedder کل سند را می‌بیند و به ازای هر Chunk یک بردار تولید می‌کند | فقط در بخش متراکم (Dense)؛ در بنچمارک Anthropic اندازه‌گیری نشده است | حدود ۰.۵۰ دلار به ازای هر ۱۰ هزار Chunk | پایین |
| **HyDE** | تولید سند فرضی در زمان Query | ۲۰-۴۰٪ | هزینه LLM به ازای هر Query | متوسط |
| **Chunking والد-فرزند (Parent-Child Chunking)** | تولید Embedding برای فرزندان، بازیابی والدها | ۱۵-۳۰٪ | ندارد | متوسط |

**تفاوت کلیدی**: بازیابی زمینه‌ای (Contextual Retrieval) یک تکنیک **زمان بارگذاری (Ingestion-time)** است (یک‌بار پرداخت)، در حالی که HyDE یک تکنیک **زمان پرس‌وجو (Query-time)** است (پرداخت به ازای هر Query). برای سیستم‌های با حجم بالا، هزینه بازیابی زمینه‌ای بسیار بهتر سرشکن (Amortize) می‌شود.

### مقایسه بازیابی زمینه‌ای (Contextual Retrieval) با Late Chunking

**تکنیک Late Chunking** (توسط Jina در سال ۲۰۲۴) یک رویکرد مرتبط اما متمایز است:

<div dir="ltr">

```
Contextual Retrieval:
  Chunk ──► LLM adds context ──► Embed enriched chunk

Late Chunking:
  Full doc ──► Long-context embed model ──► Token embeddings
  ──► THEN chunk the token embeddings (preserving context)
```

</div>

روش Late Chunking به یک مدل Embedding با زمینه طولانی (مانند Jina v3) نیاز دارد و فراخوانی‌های LLM را کاملاً حذف می‌کند. این روش زمینه را از طریق مکانیسم توجه (Attention mechanism) مدل Embedding حفظ می‌کند، نه از طریق الحاق صریح متن به ابتدای Chunk. نکته موازنه‌ای (Tradeoff) این است که Late Chunking به جستجوی BM25 کمکی نمی‌کند و تنها بازیابی متراکم (Dense Retrieval) را بهبود می‌بخشد.

### مدل‌های Embedding زمینه‌ای Chunk (Contextualized Chunk Embedding Models)

همین ایده اکنون به عنوان یک API میزبانی‌شده Embedding عرضه می‌شود که هزینه بارگذاری در جدول بالا را در مقایسه با استفاده از زمینه‌ساز Claude، یک تا دو مرتبه بزرگی کاهش می‌دهد:

- **voyage-context-4** (از شرکت Voyage AI، عرضه رسمی در ۲۹ ژوئن ۲۰۲۶): یک بردار به ازای هر Chunk که زمینه کل سند را کدگذاری می‌کند، قابلیت Chunking خودکار توکار (`enable_auto_chunking=True`)، Chunkهای هم‌پوشان محلی، و مدیریت شفاف اسناد طولانی‌تر از پنجره 32K-Token آن. ۰.۱۲ دلار به ازای هر ۱ میلیون Token که نسبت به ۰.۱۸ دلار در voyage-context-3 کاهش یافته است. شرکت Voyage بهبود ۲.۰۸ درصدی در سطح Chunk و ۱.۴ درصدی در سطح سند را در مقایسه با context-3 در ۳۹ دیتاست گزارش کرده است (گزارش‌شده توسط ارائه‌دهنده). این مدل از طریق MongoDB Atlas نیز ارائه می‌شود.
- **pplx-embed-v2-context** (از شرکت Perplexity، موجود در Hugging Face، نسخه‌های 9B و 0.6B با مجوز MIT، گزارش فنی ۲۸ اکتبر ۲۰۲۶): Chunkهای یک سند را با هم کدگذاری می‌کند و هر دو اندازه از یک فضای ۱۰۲۴-بُعدی مشترک استفاده می‌کنند، بنابراین می‌توانید با نسخه 9B ایندکس‌گذاری کرده و با نسخه 0.6B پرس‌وجو نمایید. این نسخه جایگزین پیش‌نمایش ۲۵ سپتامبر شد (۲۰۴۸ بُعد، ماتریوشکا به ۱۰۲۴، int8 محلی) که در کارت مدل آن ذکر شده بردارهای آن نباید با نسخه‌های بعدی ترکیب شوند، بنابراین هر چیزی را که روی نسخه پیش‌نمایش ساخته‌اید، مجدداً Embed کنید.

| | زمینه‌سازی با LLM | Embeddingهای زمینه‌ای Chunk |
|---|---|---|
| **هزینه بارگذاری (۱۰ هزار Chunk)** | حدود ۲ تا ۴۵ دلار به‌علاوه Embedding | حدود ۰.۵۰ دلار، جایگزین Embedding می‌شود |
| **کمک به BM25** | بله (متن زمینه ایندکس می‌شود) | خیر |
| **قابلیت اشکال‌زدایی (Debuggable)** | بله، می‌توانید رشته زمینه را بخوانید | خیر، زمینه درون بردار قرار دارد |
| **وابستگی به ارائه‌دهنده (Lock-in)** | رشته‌های زمینه حتی پس از تعویض مدل Embedder باقی می‌مانند | ایندکس به مدل یک ارائه‌دهنده وابسته است؛ برای تغییر باید مجدداً Embed کنید |
| **ویرایش اسناد** | زمینه‌سازی مجدد تنها برای Chunkهای تغییریافته | ایجاد مجدد Embedding برای کل سند |

**یک پیش‌فرض معقول برای سال ۲۰۲۶**: استفاده از Embeddingهای زمینه‌ای Chunk برای بخش متراکم (Dense)، سرآیندهای قطعی Chunk برای بخش BM25، و زمینه‌سازی با LLM فقط برای دسته‌هایی از اسناد که هر دوی این روش‌ها در آن‌ها ناموفق هستند (پیش از پرداخت هزینه، آن را روی مجموعه طلایی [Golden set] خود ارزیابی کنید).

---

## معماری تولید (Production Architecture)

### معماری مرجع: Contextual RAG در مقیاس بالا

<div dir="ltr">

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INGESTION SERVICE                               │
│                                                                     │
│  Document Store ──► Chunker ──► Contextualization Queue             │
│                       │              │                              │
│                       │         ┌────┴────┐                         │
│                       │         │ Workers  │ (N parallel LLM calls) │
│                       │         │ + Cache  │                        │
│                       │         └────┬────┘                         │
│                       │              │                              │
│                       ▼              ▼                              │
│                  Raw Chunks    Contextualized Chunks                 │
│                       │              │                              │
│                       │         ┌────┴────┐                         │
│                       │         │ Embed + │                         │
│                       │         │ BM25    │                         │
│                       │         └────┬────┘                         │
│                       │              │                              │
│                       ▼              ▼                              │
│                  Metadata DB    Vector DB + BM25 Index               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     QUERY SERVICE                                   │
│                                                                     │
│  Query ──► [Vector Search] + [BM25 Search]                          │
│                    │               │                                │
│                    └───── RRF ─────┘                                │
│                           │                                         │
│                      Top 25 chunks                                  │
│                           │                                         │
│                      Reranker (Cohere Rerank 5, Voyage rerank-3,    │
│                      or a self-hosted cross-encoder)                │
│                           │                                         │
│                      Top 5 chunks                                   │
│                           │                                         │
│                      LLM Generation                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

</div>

### ملاحظات مقیاس‌پذیری (Scaling Considerations)

| دغدغه | راهکار |
|---------|----------|
| **توان عملیاتی (Throughput) بارگذاری** | موازی‌سازی فراخوانی‌های LLM (۵۰ تا ۱۰۰ فراخوانی هم‌روند) با Workerهای ناهمگام (Async) |
| **به‌روزرسانی اسناد** | زمینه‌سازی مجدد تنها برای Chunkهای تغییریافته؛ ذخیره جداگانه متن خام + زمینه |
| **هزینه در مقیاس بالا** | مدل کوچک + کش کردن Prompt (Prompt caching)، زمان‌بندی هم‌زمان Chunkهای یک سند؛ استفاده از Batch API برای بارگذاری‌های انبوه قبلی (Backfills)؛ یا مدل Embedding زمینه‌ای |
| **پایش کیفیت** | نمونه‌برداری از ۱٪ از Chunkها و ارزیابی انسانی کیفیت زمینه |
| **سازگاری ایندکس** | به‌روزرسانی اتمیک پایگاه داده برداری (Vector Database) + ایندکس BM25 به ازای هر سند |
| **تغییر و بازنشستگی مدل (Model churn)** | ذخیره شناسه (ID) مدل زمینه‌ساز و نسخه Prompt همراه با هر رشته زمینه. رشته‌های موجود با بازنشستگی آن مدل همچنان معتبر می‌مانند؛ پیش از ترکیب سبک‌ها در یک ایندکس، خروجی مدل جایگزین را نمونه‌برداری و بررسی کنید |

---

## سوالات مصاحبه

### سوال: بازیابی زمینه‌ای (Contextual Retrieval) شرکت Anthropic را توضیح دهید. چه زمانی از آن استفاده می‌کنید و چه زمانی از آن صرف‌نظر می‌کنید؟

**پاسخ قوی:**
بازیابی زمینه‌ای (Contextual Retrieval) مشکل «رقیق‌شدن زمینه» (Context Dilution) را در RAG حل می‌کند. زمانی که اسناد به بخش‌های کوچک (Chunk) تقسیم می‌شوند، هر Chunk زمینه پیرامونی خود را که به آن معنا می‌بخشد از دست می‌دهد: یک Chunk که می‌گوید «قیمت آن ۲۰۰ دلار است»، بدون دانستن اینکه *چه چیزی* ۲۰۰ دلار قیمت دارد، کاملاً بی‌فایده است. این تکنیک در زمان بارگذاری (Ingestion time) از یک LLM برای تولید یک رشته زمینه کوتاه (۵۰ تا ۱۰۰ Token) به ازای هر Chunk استفاده می‌کند که توضیح می‌دهد این Chunk در ساختار کل سند درباره چه موضوعی است. این زمینه پیش از مرحله Embedding و ایندکس‌گذاری BM25، به ابتدای Chunk الحاق می‌شود.

نتایج کلیدی: استفاده از Embeddingهای زمینه‌ای به تنهایی خطاهای بازیابی را ۳۵٪ کاهش می‌دهد. افزودن BM25 زمینه‌ای به کاهش ۴۹ درصدی منجر می‌شود و اضافه کردن یک بازرتبه‌بند (Reranker) این کاهش خطا را به ۶۷٪ می‌رساند.

من زمانی از آن استفاده می‌کنم که Chunkها به صورت مجزا معنای خود را از دست بدهند: مانند قراردادهای حقوقی، گزارش‌های مالی و راهنماهای فنی. اما در مواردی که Chunkها از پیش خودبسنده هستند (مانند سوالات متداول [FAQs]، کارت‌های مشخصات محصول) یا زمانی که پیکره متنی (Corpus) به اندازه کافی کوچک است که بتوان از RAG با زمینه طولانی (Long-context RAG) استفاده کرد، از آن صرف‌نظر می‌کنم.

### سوال: یک پایگاه دانش با ۵۰,۰۰۰ سند به بازیابی زمینه‌ای (Contextual Retrieval) نیاز دارد. هزینه بارگذاری (Ingestion) را چگونه مدیریت می‌کنید؟

**پاسخ قوی:**
چهار استراتژی:
۱. **انتخاب مدل**: برای زمینه‌سازی از یک مدل کوچک و سریع (در رده Claude Haiku 5.5 یا GPT-6 Luna، هر دو با قیمت ۰.۱۰ / ۰.۵۰ دلار) استفاده کنید. خروجی صرفاً یک متن کوتاه و واقعی (Factual) است، نه یک نوشته خلاقانه. یک مدل پیشرو (Frontier model) بدون افزایش کیفیت، تنها هزینه را بالا می‌برد و جدیدترین مدل‌های Claude Opus و Sonnet شامل Tokenهای استدلال هستند که نمی‌توانید آن‌ها را کاملاً غیرفعال کنید؛ حتی در Haiku 5.5 نیز سطح تلاش (Effort) را روی پایین تنظیم کنید. اسناد را زیر خط قیمتی 100K-Token در Haiku 5.5 نگه دارید یا آن‌ها را تقسیم نمایید.
۲. **کش کردن Prompt (Prompt caching)**: متن کامل سند را در تمام فراخوانی‌های زمینه‌سازی Chunk کش کنید و Chunkهای هر سند را هم‌زمان زمان‌بندی نمایید تا درون پنجره زمانی انقضای کش (Cache TTL) قرار گیرند. برای سندی با ۱۰,۰۰۰ Token و ۳۰ عدد Chunk، این کار هزینه ورودی سند را تقریباً ۸۵٪ کاهش می‌دهد.
۳. **رویکرد لایه‌ای (Tiered approach)**: همه اسناد به زمینه‌سازی توسط LLM نیاز ندارند. برای اسناد دارای ساختار مناسب (مانند Markdown و HTML با سرآیندها)، از سرآیندهای زمینه‌ای قطعی Chunk (افزودن عنوان سند + سلسله‌مراتب بخش‌ها به ابتدا) استفاده کنید که کاملاً رایگان است. زمینه‌سازی با LLM را برای اسناد بدون ساختار یا مبهم رزرو کنید.
۴. **انتقال زمینه به مدل Embedder**: مدل‌های Embedding زمینه‌ای Chunk مانند voyage-context-4 (با قیمت ۰.۱۲ دلار به ازای هر ۱ میلیون Token) بردارهای Chunk آگاه از سند را بدون نیاز به فراخوانی LLM به ازای هر Chunk تولید می‌کنند. برای ۵۰,۰۰۰ سند با حدود ۸,۰۰۰ Token (مجموعاً ۴۰۰ میلیون Token)، هزینه تقریباً ۵۰ دلار خواهد بود، در حالی که با استفاده از Haiku 5.5 یا Luna به همراه کش کردن حدود ۲۰۰ تا ۳۰۰ دلار (و حدود ۲,۰۰۰ دلار با Haiku 4.5) هزینه دارد. این اختلاف هزینه نسبت به گذشته کمتر شده است، بنابراین عامل تعیین‌کننده بیش از آنکه قیمت باشد، کیفیت روی مجموعه طلایی (Golden set) شماست. نکته قابل توجه این است که این روش تنها به بخش متراکم (Dense) کمک می‌کند، بنابراین من آن را با سرآیندهای Chunk برای BM25 ترکیب می‌کنم و زمینه‌سازی با LLM را برای اسنادی نگه می‌دارم که همچنان در مجموعه طلایی با شکست مواجه می‌شوند.

### سوال: بازیابی زمینه‌ای (Contextual Retrieval) در مقایسه با HyDE برای بهبود کیفیت بازیابی چگونه عمل می‌کند؟

**پاسخ قوی:**
آن‌ها دو جنبه مختلف از یک مسئله مشترک را حل می‌کنند. بازیابی زمینه‌ای (Contextual Retrieval) **اسناد** را در زمان بارگذاری غنی‌سازی می‌کند (یک‌بار پرداخت)، در حالی که HyDE **پرس‌وجوها (Queryها)** را در زمان جستجو غنی می‌سازد (پرداخت به ازای هر Query). برای سیستمی که روزانه ۱۰,۰۰۰ پرس‌وجو را بر روی پیکره‌ای با ۵۰,۰۰۰ Chunk پردازش می‌کند، بازیابی زمینه‌ای به طور چشمگیری ارزان‌تر است زیرا هزینه بارگذاری سرشکن می‌شود. HyDE همچنین با خطر توهم (Hallucination) همراه است: سند فرضی ممکن است داده‌های نادرستی را وارد نماید. در عمل، قوی‌ترین سیستم‌ها از هر دو روش استفاده می‌کنند: بازیابی زمینه‌ای برای غنی‌سازی در زمان بارگذاری، و HyDE (یا بسط چندگانه پرس‌وجو [Multi-query expansion]) برای پرس‌وجوهای پیچیده‌ای که به راهنمایی در سمت پرس‌وجو نیاز دارند.

---

## منابع
- Anthropic. "Contextual Retrieval" (سپتامبر ۲۰۲۴)
- Jina AI. "Late Chunking: Contextual Chunk Embeddings Using Long-Context Embedding Models" (۲۰۲۴)
- Voyage AI. "voyage-context-3: Contextualized Chunk Embeddings" (۲۰۲۵)
- Voyage AI. "voyage-context-4" (ژوئن ۲۰۲۶)
- Perplexity. "pplx-embed-v2-context-9b" model card (Hugging Face، اکتبر ۲۰۲۶) و گزارش فنی (arXiv 2610.38854، ۲۸ اکتبر ۲۰۲۶)
- NirDiamant. "RAG Techniques: Contextual Chunk Headers" (GitHub، ۲۰۲۴)

---

*قبلی: [الگوهای بازیابی پیشرفته](09-advanced-retrieval-patterns.md) | بعدی: [تعامل دیرهنگام و ColBERT](11-late-interaction-colbert.md)*

</div>
