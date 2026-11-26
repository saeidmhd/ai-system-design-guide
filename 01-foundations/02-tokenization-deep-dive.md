<div dir="rtl">

# بررسی عمیق Tokenization

فرایند Tokenization تبدیل متن به واحدهای گسسته (Tokenها) است که مدل‌ها می‌توانند آن‌ها را پردازش کنند. این فرایند مستقیماً بر قابلیت‌ها، هزینه‌ها و عملکرد مدل تأثیر می‌گذارد.

## فهرست مطالب

- [چرا Tokenization اهمیت دارد](#why-tokenization-matters)
- [الگوریتم‌های Tokenization](#tokenization-algorithms)
- [موازنه‌های طراحی واژگان](#vocabulary-design-tradeoffs)
- [Tokenهای ویژه](#special-tokens)
- [Tokenization چندزبانه](#multilingual-tokenization)
- [Tokenization چندوجهی](#multimodal-tokenization-pixels-to-tokens)
- [شمارش Token برای برآورد هزینه](#token-counting-for-cost-estimation)
- [مشکلات رایج Tokenization](#common-tokenization-issues)
- [الگوهای کاربردی Tokenization](#practical-tokenization-patterns)
- [سوالات مصاحبه](#interview-questions)
- [منابع](#references)

---

<a id="why-tokenization-matters"></a>

## چرا Tokenization اهمیت دارد

### برای طراحی سیستم

1. **هزینه**: APIهای LLM بر اساس هر Token هزینه دریافت می‌کنند. کارایی Tokenization مستقیماً بر هزینه‌ها تأثیر می‌گذارد.
2. **محدودیت‌های کانتکست**: تعداد Tokenها، و نه تعداد کلمات، مشخص می‌کند چه مقدار متن در کانتکست (Context) جای می‌گیرد.
3. **قابلیت**: برخی از وظایف (مانند شمارش کاراکترها و حل آناگرام‌ها) به دلیل نحوه کار Tokenization دشوار هستند.
4. **سازگاری**: یک متن یکسان در مدل‌های مختلف به صورت متفاوتی Tokenize می‌شود.

### برای درک رفتار LLM

**سوال کلاسیک مصاحبه**: چرا GPT در شمارش حروف کلمه "strawberry" با مشکل مواجه می‌شود؟

زیرا "strawberry" به چندین زیرکلمه (Subword) تقسیم (Tokenize) می‌شود. مدل هرگز کاراکترهای منفرد را نمی‌بیند؛ بلکه واحدهای زیرکلمه‌ای را می‌بیند. شمارش حروف نیازمند استدلال درباره ساختار داخلی Tokenها است.

---

<a id="tokenization-algorithms"></a>

## الگوریتم‌های Tokenization

### کدگذاری جفت بایت (BPE)

رایج‌ترین الگوریتم که توسط سری مدل‌های GPT، Llama، Qwen و DeepSeek استفاده می‌شود.

**الگوریتم آموزش:**
1. شروع با واژگانی متشکل از تک‌بایت‌ها (۲۵۶ عدد Token)
2. شمارش تمام جفت‌های مجاور Token در پیکره متنی آموزشی (Corpus)
3. ادغام پرتکرارترین جفت در یک Token جدید
4. تکرار تا رسیدن به اندازه واژگان مورد نظر

**مثال:**

<div dir="ltr">

```
Corpus: "low lower lowest"
Initial: ['l', 'o', 'w', ' ', 'l', 'o', 'w', 'e', 'r', ' ', 'l', 'o', 'w', 'e', 's', 't']

Step 1: Most frequent pair is ('l', 'o'). Merge to 'lo'.
['lo', 'w', ' ', 'lo', 'w', 'e', 'r', ' ', 'lo', 'w', 'e', 's', 't']

Step 2: Most frequent pair is ('lo', 'w'). Merge to 'low'.
['low', ' ', 'low', 'e', 'r', ' ', 'low', 'e', 's', 't']

Step 3: Most frequent pair is ('low', 'e'). Merge to 'lowe'.
['low', ' ', 'lowe', 'r', ' ', 'lowe', 's', 't']

Continue until vocabulary size target...
```

</div>

**ویژگی‌ها:**
- فرایند Tokenization قطعی (Deterministic) با داشتن واژگان آموزش‌دیده
- کلمات رایج تمایل دارند به صورت تک Token ظاهر شوند
- کلمات نادر به زیرکلمه‌ها تقسیم می‌شوند

### WordPiece

توسط مدل‌های خانواده BERT استفاده می‌شود.

**تفاوت کلیدی با BPE:**
- الگوریتم BPE: ادغام بر اساس فرکانس (تکرار)
- الگوریتم WordPiece: ادغام بر اساس بهبود درستی‌نمایی (Likelihood)

<div dir="ltr">

```
Score = freq(AB) / (freq(A) * freq(B))
```

</div>

این رویکرد ادغام‌هایی را ترجیح می‌دهد که نسبت به هم‌آیی‌های تصادفی، معنادارتر باشند.

**نشانگر بصری:** WordPiece از پیشوند ## برای Tokenهای ادامه استفاده می‌کند:

<div dir="ltr">

```
"embedding" becomes ["em", "##bed", "##ding"]
```

</div>

### الگوریتم Unigram (SentencePiece)

توسط T5، ALBERT و برخی مدل‌های چندزبانه استفاده می‌شود.

**الگوریتم آموزش:**
1. شروع با یک واژگان کاندید بزرگ
2. محاسبه مقدار Loss در صورت حذف هر Token
3. حذف Tokenهایی که کمترین افزایش را در Loss ایجاد می‌کنند
4. تکرار تا رسیدن به اندازه واژگان مورد نظر

**تفاوت کلیدی:** به جای فرکانس، با احتمالات کار می‌کند و می‌تواند ادغام‌های اولیه زیربهینه (Suboptimal) را جبران و بازیابی کند.

### مقایسه

| الگوریتم | معیار ادغام | نوع Tokenization | استفاده‌شده در |
|-----------|-----------------|--------------|---------|
| BPE | تکرار (Frequency) | قطعی (Deterministic) | مدل GPT، Llama، Qwen |
| WordPiece | درستی‌نمایی (Likelihood) | قطعی (Deterministic) | مدل‌های BERT و DistilBERT |
| Unigram | احتمال (Probability) | احتمالاتی (Probabilistic) | مدل‌های T5، mT5 و XLNet |

---

<a id="vocabulary-design-tradeoffs"></a>

## موازنه‌های طراحی واژگان

### اندازه واژگان

| اندازه | مثال | مزایا | معایب |
|------|---------|------|------|
| کوچک (10K) | برخی مدل‌های اولیه | فضای Embeddings کوچک‌تر | توالی‌های طولانی از Tokenها |
| متوسط (32K) | مدل Llama 2، Mistral 7B | تعادل مناسب | ناکارآمدی در چندزبانگی |
| بزرگ (100K-152K) | مدل GPT-4 (cl100k)، Llama 3 (128K)، DeepSeek V3 و V4.1 (~129K)، Mistral Tekken (~131K)، Qwen3 (~152K) | **پیش‌فرض رایج برای مدل‌های متن‌باز.** نسبت فشرده‌سازی بالا. | جدول Embeddings بزرگ‌تر |
| بسیار بزرگ (+200K) | مدل GPT-4o تا GPT-5.x (o200k، ~200K)، Llama 4 (~202K)، Gemma 3 (~262K) | کارایی چندوجهی و چندزبانه | فشار حافظه روی LM Head |

شرکت‌های Anthropic و Google اندازه واژگان را برای Claude و Gemini منتشر نمی‌کنند، و tiktoken صرفاً انکودینگ‌های منتشرشده توسط OpenAI را پوشش می‌دهد (o200k_base برای GPT-4o تا GPT-5.x). برای هر مدلی که نمی‌توانید Tokenizer آن را بارگذاری و تأیید کنید، شمارش را با API شمارش Token ارائه‌دهنده یا فیلد `usage` در پاسخ انجام دهید، نه با یک Tokenizer نیابتی (Proxy).

**واکاوی دقیق گسترش واژگان:**
- **مدل Llama 3 (128K)**: متا ۱۰۰ هزار Token از tiktoken را با ۲۸ هزار Token اضافی با هدف زبان‌های غیرانگلیسی ترکیب کرد و گزارش داد که برای یک متن یکسان، تا ۱۵٪ Tokenهای کمتری نسبت به Llama 2 مصرف می‌کند. مدل Llama 4 به حدود ۲۰۲ هزار Token رسید.
- **مدل‌های GPT-4o تا GPT-5.x (o200k_base)**: دو برابر کردن واژگان cl100k فشرده‌سازی را برای کد و متون غیرانگلیسی بهبود بخشید، که هزینه به ازای هر واحد معنایی را حتی با همان قیمت ثابت به ازای هر Token کاهش می‌دهد.
- **قیمت یکسان، صورت‌حساب متفاوت**: تغییر Tokenizer می‌تواند مبلغ صورت‌حساب شما را بدون هیچ تغییری در لیست قیمت‌ها جابه‌جا کند. اسناد Anthropic بیان می‌کنند که Claude 4.7 و مدل‌های پس از آن از Tokenizer جدیدتری استفاده می‌کنند که برای یک متن یکسان، تقریباً ۳۰٪ Tokenهای بیشتری نسبت به مدل‌های اولیه Claude تولید می‌کند که مقدار دقیق این افزایش به محتوا بستگی دارد. مدل Claude Haiku 5.5 این موضوع را به رده مدل‌های کوچک نیز تعمیم داد: حدود ۳۰٪ Tokenهای بیشتر نسبت به Haiku 4.5؛ بنابراین قیمت پایه آن که یک‌دهم Haiku 4.5 است، در عمل کاهش کمتری به ازای هر واحد متن نسبت به آنچه در جدول تعرفه‌ها اعلام شده فراهم می‌کند. هر زمان که خانواده مدل‌ها را تغییر می‌دهید، مبنای شمارش Tokenها (Token counts) را مجدداً ارزیابی کنید.

### کاراکتر در برابر زیرکلمه در برابر کلمه

| دانه‌بندی (Granularity) | مثال | واحدهای Token برای "running" | موازنه‌ها |
|-------------|---------|---------------------|-----------|
| کاراکتر | ByT5 | ['r','u','n','n','i','n','g'] | از هر متنی پشتیبانی می‌کند اما توالی‌ها بسیار طولانی می‌شوند |
| زیرکلمه (Subword) | GPT | ['running'] یا ['run','ning'] | تعادل مناسب |
| کلمه | پردازش زبان طبیعی اولیه (Early NLP) | ['running'] | توالی‌های کوتاه‌تر، اما ناتوان در مدیریت OOV |

امروزه LLMها به طور همگانی از Tokenization زیرکلمه‌ای (Subword) برای برقراری تعادل میان اندازه واژگان و طول توالی استفاده می‌کنند.

### الگوریتم Byte-Level BPE

مدل GPT-2 مفهوم Byte-Level BPE را معرفی کرد:
- واژگان پایه به جای کاراکترها، از ۲۵۶ بایت تشکیل شده است
- می‌تواند هر متنی را بدون Tokenهای UNK نمایش دهد
- یونی‌کد (Unicode) به صورت طبیعی به عنوان توالی‌هایی از بایت‌ها مدیریت می‌شود

<div dir="ltr">

```python
# Character-level: Needs explicit handling of characters
text = "cafe"  # Unknown character might become [UNK]

# Byte-level: Works with any text (no UNK needed)
text = "cafe"  # Becomes bytes, then BPE operates on bytes
```

</div>

---

<a id="special-tokens"></a>

## واحدهای Token ویژه

واحدهای Token ویژه اطلاعات ساختاری فراتر از متن عادی را مدیریت می‌کنند:

| Token | هدف | مثال |
|-------|---------|---------|
| BOS | آغاز توالی (Beginning of sequence) | نشانه شروع فرایند تولید |
| EOS | پایان توالی (End of sequence) | نشانه اتمام تولید |
| PAD | پدینگ (Padding) | پر کردن دسته‌ها (Batches) تا رسیدن به طول برابر |
| UNK | نشانه Token ناشناخته (Unknown token) | راهکار جایگزین برای کلمات خارج از واژگان (OOV) (در Byte BPE نادر است) |
| SEP | جداکننده (Separator) | تفکیک بخش‌ها (به سبک BERT) |

### قالب‌های چت (Chat Templates)

مدل‌های چت امروزی از Tokenهای ویژه برای تعیین ساختار مکالمه استفاده می‌کنند:

**قالب Llama 2:**

<div dir="ltr">

```
[INST] <<SYS>>
You are a helpful assistant.
<</SYS>>

User message here [/INST] Assistant response here
```

</div>

**قالب ChatML (سبک OpenAI):**

<div dir="ltr">

```
<|im_start|>system
You are a helpful assistant.<|im_end|>
<|im_start|>user
Hello!<|im_end|>
<|im_start|>assistant
Hi there!<|im_end|>
```

</div>

**چرا این موضوع اهمیت دارد:**
- قالب‌بندی نادرست به نتایج ضعیف منجر می‌شود
- واحدهای Token ویژه در داده‌های پیش‌آموزش (Pre-training) وجود ندارند
- کتابخانه‌هایی مانند transformers از chat_template برای قالب‌بندی خودکار استفاده می‌کنند

---

<a id="multilingual-tokenization"></a>

## فرآیند Tokenization چندزبانه

### چالش

ابزارهای Tokenizer که عمدتاً روی زبان انگلیسی آموزش دیده‌اند، برای سایر زبان‌ها کارایی ضعیفی دارند:

| زبان | واحدهای Token برای "Hello" | واحدهای Token برای معادل سلام |
|----------|-------------------|-------------------------------|
| انگلیسی | 1 ("Hello") | - |
| چینی | - | ۲-۳+ برای معادل |
| ژاپنی | - | ۳-۵+ برای معادل |
| کره‌ای | - | ۲-۴+ برای معادل |

**پیامد هزینه‌ای:** در Tokenizerهای انگلیسی‌محور، کاربران غیرانگلیسی ۲ تا ۳ برابر بیشتر به ازای هر واحد معنایی هزینه پرداخت می‌کنند. واژگان بزرگ‌تر امروزی این فاصله را برای زبان‌های اصلی کاهش داده‌اند، اما آن را از بین نبرده‌اند.

### راهکارها

1. **پیکره متنی آموزشی چندزبانه:** آموزش Tokenizer روی داده‌های متوازن چندزبانه
2. **واژگان بزرگ‌تر:** فضای بیشتر برای Tokenهای غیرانگلیسی
3. **ابزارهای Tokenizer اختصاصی زبان:** Tokenizerهای جداگانه برای هر خانواده زبانی

**مدل‌های دارای پشتیبانی مناسب از چندزبانگی:**
- مدل‌های mT5 و XLM-R: آموزش‌دیده روی بیش از ۱۰۰ زبان
- مدل‌های فعلی GPT، Claude و Qwen: دارای واژگان بزرگ با پوشش گسترده چندزبانه
- مدل Gemini: طراحی‌شده برای چندزبانگی از همان ابتدا

ضریب تقریبی Tokenها در مقایسه با متن انگلیسی معادل (صرفاً برای تقریب؛ روی پیکره متنی خودتان اندازه‌گیری کنید، زیرا این نسبت‌ها بر اساس حوزه کاربرد و رسم‌الخط متفاوت است):

| Tokenizer | چینی | ژاپنی | کره‌ای | هندی |
|-------|---------|----------|--------|--------|
| GPT-2 | 2.5x | 3.0x | 2.8x | 6.0x |
| GPT-4 (cl100k) | 1.4x | 1.6x | 1.5x | 3.2x |
| توکنایزر o200k (GPT-4o تا GPT-5.x) | 1.1x | 1.2x | 1.1x | 1.4x |
| Llama 3 (128K) | 1.2x | 1.3x | 1.2x | 1.5x |

---

<a id="multimodal-tokenization-pixels-to-tokens"></a>

## فرآیند Tokenization چندوجهی (pixels-to-tokens)

مدل‌های چندوجهی بومی (Native Multimodal) مدرن فقط تصاویر را «نمی‌بینند»؛ بلکه آن‌ها را Tokenize می‌کنند.

### فرآیند Tokenization تصویر (Vision Transformers)
تصاویر به وصله‌ها یا پچ‌هایی (Patch - به‌عنوان مثال ۱۴×۱۴ پیکسل) تقسیم می‌شوند. هر پچ از یک انکودر بینایی (مانند SigLIP) عبور داده می‌شود تا یک Token بصری منفرد تولید شود.
- **هزینه ثابت Token (Fixed Token Cost):** اکثر مدل‌ها از تعداد ثابتی Token به ازای هر تصویر در یک رزولوشن مشخص استفاده می‌کنند (مثلاً ۲۵۶ یا ۷۲۹ Token به ازای هر تصویر).
- **رزولوشن پویا (Dynamic Resolution):** برخی مدل‌ها (Gemini 3) بسته به نسبت ابعاد تصویر و سطح جزئیات، از تعداد متغیری Token استفاده می‌کنند.
- **بدون انکودر (Encoder-free):** مدل Gemma 4 12B "Unified" (ژوئن ۲۰۲۶) انکودر بینایی را حذف کرده و پچ‌های خام تصویر و شکل‌موج‌های صوتی را با استفاده از لایه‌های خطی سبک مستقیماً به فضای Embedding مربوط به LLM نگاشت می‌کند. در این صورت، هزینه Token مستقیماً از تعداد پچ‌ها پیروی می‌کند.

### فرآیند Tokenization صدا و ویدیو
- **صدا (Audio):** با استفاده از کدک‌هایی مانند EnCodec به واحدهای گسسته فشرده شده و سپس به‌صورت توالی‌ای از Tokenهای صوتی نمایش داده می‌شود.
- **ویدیو (Video):** به‌صورت توالی‌ای از فریم‌های تصویر پردازش می‌شود (Tokenization زمانی یا Temporal). یک ویدیوی ۱ ثانیه‌ای با نرخ 1FPS ممکن است هزینه‌ای به اندازه ۱ تصویر با وضوح بالا از نظر Token داشته باشد.
- **پردازش ایجنتی ویدیو (Agentic video processing):** از ۱ سپتامبر ۲۰۲۶،‏ Gemini API یک حالت اختیاری `"processing": "agentic"` را روی Gemini 3.8 Flash،‏ 3.6 Flash و 3.5 Flash-Lite ارائه می‌دهد (درخواست‌های ارسالی به `gemini-3.7-flash` که در زمان عرضه نیز پشتیبانی می‌شدند، از ۸ اکتبر به 3.8 Flash هدایت شده‌اند). مدل به‌جای نمونه‌برداری با نرخ ثابت، تصمیم می‌گیرد کدام بخش‌ها را با چه سرعتی و از طریق کدام وجه یا مُدالیتی (فریم‌ها، صدا یا رونوشت متنی) بررسی کند. گوگل گزارش می‌دهد که این رویکرد در بنچمارک‌های استاندارد ویدیو تا ۸۸٪ Token کمتر و تا ۶۶٪ هزینه پایین‌تر به همراه دارد که با قیمت‌های معمولی Token محاسبه می‌شود. نمونه‌برداری ایستا با نرخ 1 FPS همچنان حالت پیش‌فرض باقی مانده است، بنابراین یک مدل هزینه که بر اساس نمونه‌برداری با نرخ ثابت ساخته شده باشد می‌تواند Tokenهای حالت ایجنتی را تا حدود ۸ برابر بیش‌ازحد برآورد کند.

---

<a id="token-counting-for-cost-estimation"></a>

## شمارش Token برای برآورد هزینه

### قوانین برآورد سریع

برای متن انگلیسی:
- **کلمات به Token:** حدود ۱.۳ Token به ازای هر کلمه
- **کاراکترها به Token:** حدود ۴ کاراکتر به ازای هر Token
- **صفحات به Token:** حدود ۵۰۰ تا ۸۰۰ Token به ازای هر صفحه

<div dir="ltr">

```python
def estimate_tokens(text: str) -> int:
    # Rough estimation for English
    word_count = len(text.split())
    return int(word_count * 1.3)
```

</div>

### شمارش دقیق

از Tokenizer اختصاصی هر مدل استفاده کنید، یا در مواردی که Tokenizer عمومی نیست، از اندپوینت شمارش ارائه‌دهنده بهره ببرید:

<div dir="ltr">

```python
import tiktoken

# For OpenAI models (tiktoken ships OpenAI encodings only; o200k_base
# covers GPT-4o through GPT-5.x)
encoding = tiktoken.get_encoding("o200k_base")
tokens = encoding.encode("Your text here")
token_count = len(tokens)

# For open-weight models, use the model's own Hugging Face tokenizer
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
tokens = tokenizer.encode("Your text here")
token_count = len(tokens)

# For Claude, the tokenizer is not public: call the count_tokens endpoint
import anthropic
client = anthropic.Anthropic()
count = client.messages.count_tokens(
    model="claude-sonnet-5-5",
    messages=[{"role": "user", "content": "Your text here"}],
)
token_count = count.input_tokens
```

</div>

مدل Gemini فراخوانی معادل `countTokens` را دارد و Responses API شرکت OpenAI نیز یک اندپوینت شمارش Token ورودی برای مدل‌هایی که tiktoken آن‌ها را نگاشت نمی‌کند، ارائه می‌دهد. هرگز Tokenهای مدل‌های Claude یا Gemini را با tiktoken تخمین نزنید: دایره واژگان مختلف، شمارش‌های متفاوتی برای یک متن یکسان ارائه می‌دهند.

### واحدهای Token استدلال (Reasoning Tokens)

در مدل‌های استدلالی، پاسخ قابل‌مشاهده تنها بخشی از صورت‌حساب خروجی است. Tokenهای تفکر یا استدلال (Thinking or reasoning tokens) در مدل‌های OpenAI،‏ Anthropic و Google حتی زمانی که متن خام استدلال بازگردانده نمی‌شود، به‌عنوان خروجی محاسبه می‌شوند و حجم آن‌ها به سطح تلاش (Effort) یا تفکری که تعیین می‌کنید بستگی دارد. بودجه‌بندی را بر اساس فیلد `usage` در API روی ترافیک واقعی انجام دهید، نه بر اساس طول پاسخ قابل‌مشاهده.

### محاسبه هزینه

<div dir="ltr">

```python
# USD per 1M tokens, standard tier list prices as of November 2026.
# Excludes cache reads/writes, batch discounts and long-context surcharges
# (OpenAI bills the whole request at higher rates above 272K input tokens,
# Claude Haiku 5.5 at 5x once the prompt passes 100K tokens).
PRICING = {
    "gpt-6-sol": {"input": 2.00, "output": 10.00},
    "gpt-6-luna": {"input": 0.10, "output": 0.50},
    "claude-sonnet-5-5": {"input": 2.00, "output": 10.00},
    "claude-haiku-5-5": {"input": 0.10, "output": 0.50},
}

def calculate_cost(input_tokens: int, output_tokens: int, model: str) -> float:
    """Token counts come from the response's usage field (output includes
    reasoning tokens), not from re-tokenizing text with a different tokenizer."""
    rates = PRICING[model]
    return (
        (input_tokens / 1_000_000) * rates["input"] +
        (output_tokens / 1_000_000) * rates["output"]
    )
```

</div>

---

<a id="common-tokenization-issues"></a>

## مشکلات رایج Tokenization

### مشکل ۱: عدم انطباق مرز Tokenها (Token Boundary Misalignment)

**مشکل:** عملیات متنی ممکن است با مرزهای Tokenها هم‌تراز نباشد.

<div dir="ltr">

```python
text = "Hello world"
# Tokens: ["Hello", " world"]  # Note: space is part of second token

# Truncating at character 6 ("Hello ") splits a token
```

</div>

**راه‌حل:** هنگام مدیریت کانتکست، همیشه برش متن (Truncate) را در مرزهای Tokenها انجام دهید.

### مشکل ۲: Tokenization ناسازگار (Inconsistent Tokenization)

**مشکل:** یک متن یکسان بسته به کانتکست پیرامونی، به شکل متفاوتی Tokenize می‌شود.

<div dir="ltr">

```python
# GPT tokenizer example
"New York"     # Might be ["New", " York"]
"NewYork"      # Might be ["New", "York"]
" New York"    # Might be [" New", " York"]
```

</div>

**پیامد:** تعداد Tokenها می‌تواند بر اساس متن اطراف تغییر کند. همیشه کل کانتکست را به‌صورت کامل Tokenize کنید.

### مشکل ۳: کد و داده‌های ساختاریافته

**مشکل:** کدها و داده‌های JSON اغلب از نظر Tokenization ناکارآمد هستند (تعداد زیادی Token مصرف می‌کنند).

<div dir="ltr">

```python
# Python code often tokenizes poorly
"def calculate_average(numbers):"
# Becomes many tokens: ["def", " calculate", "_", "average", "(", "numbers", "):", ...]

# JSON keys tokenize individually
'{"firstName": "John"}'
# Many tokens for structure
```

</div>

**راهکارهای کاهش اثر (Mitigation):**
- برخی مدل‌ها دارای Tokenizerهای بهینه‌سازی‌شده برای کد هستند
- فشرده‌سازی JSON را پیش از ارسال در نظر داشته باشید
- در صورت در دسترس بودن، از حالت‌های خروجی ساختاریافته (Structured Output) استفاده کنید

### مشکل ۴: مدیریت فاصله‌های خالی (Whitespace)

**مشکل:** Tokenizerها فاصله‌های خالی (Whitespace) را به شیوه‌های متفاوتی مدیریت می‌کنند.

<div dir="ltr">

```python
# Leading spaces often become separate tokens
" Hello"  # [" ", "Hello"] or [" Hello"]

# Multiple spaces may merge or stay separate
"Hello  world"  # Behavior varies by tokenizer
```

</div>

**بهترین شیوه (Best practice):** پیش از Tokenize کردن، فاصله‌های خالی را نرمال‌سازی کنید.

---

<a id="practical-tokenization-patterns"></a>

## الگوهای کاربردی Tokenization

### الگوی ۱: مدیریت پنجره کانتکست (Context Window Management)

<div dir="ltr">

```python
def fit_to_context(
    system_prompt: str,
    user_message: str,
    history: list[str],
    max_tokens: int = 8000,
    reserve_for_output: int = 2000
) -> str:
    # Use the target model's tokenizer; o200k_base fits OpenAI models only
    encoding = tiktoken.get_encoding("o200k_base")
    
    available = max_tokens - reserve_for_output
    
    # System prompt always included
    tokens_used = len(encoding.encode(system_prompt))
    available -= tokens_used
    
    # User message always included
    tokens_used = len(encoding.encode(user_message))
    available -= tokens_used
    
    # Add history from most recent, drop oldest if needed
    included_history = []
    for msg in reversed(history):
        msg_tokens = len(encoding.encode(msg))
        if msg_tokens <= available:
            included_history.insert(0, msg)
            available -= msg_tokens
        else:
            break
    
    return format_prompt(system_prompt, included_history, user_message)
```

</div>

### الگوی ۲: Chunking در مرزهای Tokenها

<div dir="ltr">

```python
def chunk_at_token_boundaries(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50
) -> list[str]:
    encoding = tiktoken.get_encoding("o200k_base")
    tokens = encoding.encode(text)
    
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunk_text = encoding.decode(chunk_tokens)
        chunks.append(chunk_text)
        start = end - overlap
    
    return chunks
```

</div>

### الگوی ۳: تخصیص بودجه Token (Token Budget Allocation)

<div dir="ltr">

```python
class TokenBudget:
    def __init__(self, total: int):
        self.total = total
        self.allocated = {}
    
    def allocate(self, component: str, tokens: int) -> bool:
        used = sum(self.allocated.values())
        if used + tokens > self.total:
            return False
        self.allocated[component] = tokens
        return True
    
    def remaining(self) -> int:
        return self.total - sum(self.allocated.values())

# Usage
budget = TokenBudget(total=8000)
budget.allocate("system_prompt", 500)
budget.allocate("retrieved_context", 2000)
budget.allocate("user_message", 200)
budget.allocate("output_reserve", 2000)
# Remaining: 3300 tokens for conversation history
```

</div>

---

<a id="interview-questions"></a>

## سوالات مصاحبه

### سوال: چرا LLMها در شمارش ساده کاراکترها به مشکل می‌خورند؟

**پاسخ قوی:**
فرآیند Tokenization متن را به واحدهای زیرکلمه (Subword)، و نه کاراکترها، تبدیل می‌کند. هنگامی که از مدل پرسیده می‌شود «کلمه strawberry چند حرف 'r' دارد؟»، مدل به‌جای حروف مجزا، Tokenهایی مانند ["str", "aw", "berry"] را می‌بیند.

مدل باید در مورد ساختار درونی Tokenهایی که مستقیماً آن‌ها را مشاهده نمی‌کند استدلال نماید. این امر مستلزم به‌خاطرسپردن یا محاسبه ترکیب کاراکتری Tokenها است که یک توانمندی نوظهور (Emergent capability) محسوب می‌شود و همواره قابل‌اعتماد نیست.

راه‌حل این است که در Prompt به مدل هدایت شود ابتدا کلمه را حرف‌به‌حرف هجی کند و سپس شمارش را انجام دهد. این کار ایجاد Tokenهای سطح کاراکتر را اجباری می‌کند.

### سوال: چگونه تعداد Token را برای برنامه‌ریزی هزینه برآورد می‌کنید؟

**پاسخ قوی:**
برای برآورد تقریبی: تعداد کلمات را برای متن انگلیسی در ۱.۳ ضرب کنید.

برای شمارش دقیق: از Tokenizer اختصاصی هر مدل استفاده کنید:
- مدل‌های OpenAI: استفاده از tiktoken برای انکودینگ‌هایی که ارائه می‌دهد (`o200k_base` برای GPT-4o تا GPT-5.x)؛ برای مدلی که tiktoken آن را نگاشت نمی‌کند، از اندپوینت شمارش Token ورودی در Responses API یا فیلد `usage` استفاده کنید
- مدل‌های با وزن باز (Open-weight): استفاده از Tokenizer خود مدل در Hugging Face
- مدل‌های Claude و Gemini: استفاده از اندپوینت شمارش Token ارائه‌دهنده (Tokenizerها عمومی نیستند)

ملاحظات مهم:
- متن‌های غیرانگلیسی Tokenهای بیشتری مصرف می‌کنند: تقریباً ۱.۱ تا ۱.۵ برابر برای زبان‌های اصلی روی دایره واژگان مدرن 128K-200K، و ۳ برابر یا بیشتر روی Tokenizerهای قدیمی‌تر و خطوط با پوشش کمتر
- کدها و داده‌های ساختاریافته از نظر Tokenization ناکارآمد هستند
- همیشه بودجه بیشتری را برای Tokenهای خروجی در نظر بگیرید (قیمت‌گذاری آن‌ها ۳ تا ۶ برابر ورودی است؛ در اکثر مدل‌های پیشروی فعلی ۵ برابر)، از جمله Tokenهای استدلال که به‌عنوان خروجی صورت‌حساب شده و متناسب با سطح تلاش (Effort level) افزایش می‌یابند
- حتماً System Promptها، تعاریف ابزارها و Tokenهای قالب‌بندی را در نظر بگیرید
- متن یکسان در هر ارائه‌دهنده تعداد متفاوتی Token مصرف می‌کند، بنابراین هزینه به ازای هر تسک تکمیل‌شده را مقایسه کنید، نه قیمت به ازای هر Token را

برای برآورد هزینه در محیط عملیاتی (Production)، درخواست‌های واقعی را نمونه‌برداری کرده و مصرف واقعی Token را از فیلد `usage` در API می‌سنجم، سپس حاشیه‌های ایمنی (Safety margins) را اعمال می‌کنم. این اندازه‌گیری را در هر مهاجرت مدل مجدداً تکرار می‌کنم؛ زیرا تغییر Tokenizer (طبق گزارش Anthropic، مدل Claude 4.7 و نسخه‌های بعدی برای متنی یکسان حدود ۳۰٪ Token بیشتری نسبت به مدل‌های اولیه Claude می‌شمارند) یا یک سطح تلاش پیش‌فرض جدید، بدون هیچ تغییری در قیمت، رقم صورت‌حساب را تغییر می‌دهد.

### سوال: هنگام تغییر Tokenizer بین مدل‌ها چه اتفاقی می‌افتد؟

**پاسخ قوی:**
هر خانواده از مدل‌ها دارای Tokenizer اختصاصی خود است. شما نمی‌توانید Tokenها را در میان مدل‌ها استفاده مجدد کنید، زیرا:

۱. **دایره واژگان (Vocabulary) متفاوت است:** شناسه‌های Token (یا Token IDها) بیانگر رشته‌های متنی متفاوتی هستند
۲. **قوانین ادغام (Merge rules) متفاوت است:** متن یکسان به شکل‌های متفاوتی تقسیم می‌شود
۳. **واحدهای Token ویژه (Special tokens) متفاوت هستند:** قالب‌بندی چت متغیر است

پیامدهای عملی:
- همیشه از Tokenizer صحیح برای شمارش Token استفاده کنید
- مقادیر Embedding کش‌شده مختص مدل هستند
- قالب‌های Prompt نیازمند تنظیم مجزا برای هر مدل هستند
- مدل‌های Fine-tune شده، Tokenizer مدل پایه خود را به ارث می‌برند

### سوال: فرآیند Tokenization را برای Chunking در RAG چگونه مدیریت می‌کنید؟

**پاسخ قوی:**
ملاحظات کلیدی:

۱. **انجام Chunking در مرزهای Tokenها:** برش متن در میانه یک Token باعث مخدوش شدن متن هنگام Decode می‌شود
۲. **محاسبه Tokenهای الگو:** System Prompt و قالب‌بندی نیز Token مصرف می‌کنند
۳. **در نظر گرفتن فضای خالی کافی (Headroom):** تکه‌های (Chunks) بازیابی‌شده به‌همراه سوال باید در پنجره کانتکست بگنجند

رویکرد پیاده‌سازی:

<div dir="ltr">

```python
# Determine available tokens for chunks
available = max_context - system_prompt_tokens - question_tokens - output_reserve

# Chunk with overlap at token boundaries
chunks = chunk_at_token_boundaries(document, chunk_size=500, overlap=50)

# Select chunks until budget exhausted
selected = []
tokens_used = 0
for chunk in ranked_chunks:
    chunk_tokens = count_tokens(chunk)
    if tokens_used + chunk_tokens <= available:
        selected.append(chunk)
        tokens_used += chunk_tokens
```

</div>

---

<a id="references"></a>

## منابع

- سنریش و همکاران (Sennrich et al.)،‏ "Neural Machine Translation of Rare Words with Subword Units" (BPE، ۲۰۱۶)
- وو و همکاران (Wu et al.)،‏ "Google's Neural Machine Translation System" (WordPiece، ۲۰۱۶)
- کودو و ریچاردسون (Kudo and Richardson)،‏ "SentencePiece: A simple and language independent subword tokenizer" (۲۰۱۸)
- کتابخانه tiktoken شرکت OpenAI: https://github.com/openai/tiktoken
- شمارش Token در Anthropic: https://platform.claude.com/docs/en/build-with-claude/token-counting
- کتابخانه‌های Tokenizer در HuggingFace: https://github.com/huggingface/tokenizers

---

*قبلی: [سازوکار داخلی LLM](01-llm-internals.md) | بعدی: [مکانیزم‌های توجه](03-attention-mechanisms.md)*

</div>
