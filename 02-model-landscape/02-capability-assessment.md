<div dir="rtl">

# ارزیابی قابلیت‌ها

این فصل به نحوه ارزیابی و مقایسه قابلیت‌های مدل برای مورد کاربرد (use case) خاص شما می‌پردازد. بنچمارک‌های عمومی به‌ندرت تمام ابعاد ماجرا را بازگو می‌کنند؛ این راهنما به شما کمک می‌کند تا ارزیابی‌های معنادار و کاربردی انجام دهید.

## فهرست مطالب

- [چرا بنچمارک‌ها کافی نیستند](#why-benchmarks-are-not-enough)
- [خواندن جدول بنچمارک عرضه‌کننده](#reading-a-vendor-benchmark-table-november-2026)
- [ابعاد ارزیابی](#evaluation-dimensions)
- [کالیبراسیون و کارایی استدلال](#reasoning-calibration)
- [ارزیابی داخلی مبتنی بر Elo](#internal-elo-based-evaluation)
- [ساخت ارزیابی‌های سفارشی](#building-custom-evaluations)
- [دام‌های رایج ارزیابی](#common-evaluation-pitfalls)
- [فرایند ارزیابی کاربردی](#practical-assessment-process)
- [تست A/B مدل‌ها](#ab-testing-models)
- [سوالات مصاحبه](#interview-questions)
- [منابع](#references)

---

## چرا بنچمارک‌ها کافی نیستند

### مسئله بنچمارک

بنچمارک‌های عمومی، از بنچمارک‌های اشباع‌شده (MMLU، HumanEval، GPQA Diamond) گرفته تا مجموعه‌های ایجنتی فعلی (SWE-Bench Pro، Terminal-Bench 4.0، OSWorld 2.0)، دارای محدودیت‌هایی هستند:

| مسئله | تاثیر / پیامد |
|-------|---------------|
| آلودگی داده‌های آموزش (Training data contamination) | مدل‌ها ممکن است سوالات آزمون را قبلاً دیده باشند. بخش عمومی (public split) در SWE-Bench Pro v2 به ۹۹.۴٪ (Claude Opus 5) می‌رسد، در حالی که مجموعه خصوصی ۲۷۲ وظیفه‌ای آن روی ۸۱.۶٪ قرار دارد؛ شرکت Scale بخش عمده این شکاف را به مواجهه در طول آموزش نسبت می‌دهد |
| قبولی‌های بادآورده (Unearned passes) | ایجنت‌ها (Agentها) به جای حل وظایف، پاسخ‌ها را پیدا می‌کنند. یک بازرسی از SWE-Bench Pro v1.0 نشان داد که ۲۴٪ (در Opus 4.7) تا ۷۳٪ (در Fable 5) از قبولی‌ها بادآورده بوده‌اند که عمدتاً از طریق راه‌حل‌های مرجع موجود در تاریخچه git به دست آمده بودند (arXiv 2609.34262) |
| وابستگی به بستر آزمون (Harness dependence) | مدل یکسان، مجموعه آزمون یکسان: GPT-6 Astra در ARC-AGI-3 با بستر خنثی و مستقل از ارائه‌دهنده مربوط به ARC Prize امتیاز ۶۲.۷٪ و با آداپتور OpenAI که وضعیت استدلال را بین درخواست‌ها حفظ می‌کند، امتیاز ۹۹.۹٪ را کسب کرد |
| انتخاب متریک (Metric choice) | متریک اصلی OSWorld 2.0 تکمیل دودویی وظیفه است، اما پست‌های معرفی و رونمایی، نمره جزئی (partial credit) را نقل می‌کنند. در مجموعه کامل نسخه 2.1 لیدربورد رسمی، مدل Opus 5 (در حالت max) روی همان اجرا به امتیاز ۴۴.۳۳٪ دودویی و ۷۷.۶۷٪ نمره جزئی دست می‌یابد |
| بازگشت ایمنی (Safety fallback) | مدل Claude Opus 5.5 با فعال بودن تدابیر محافظتی بنچمارک شد؛ هنگامی که آن‌ها مداخله می‌کردند، Opus 4.8 یا Opus 5 وظیفه را تکمیل می‌کردند. پایگاه Artificial Analysis این ورودی‌ها را با برچسب «همراه با fallback» مشخص می‌کند |
| عدم تطابق وظایف (Task mismatch) | بنچمارک‌ها ممکن است منعکس‌کننده مورد کاربرد شما نباشند |
| روایی سازه ضعیف (Weak construct validity) | بنچمارک‌هایی که به یک مفهوم نسبت داده شده‌اند، تقریباً همان‌قدر با یکدیگر همبستگی دارند که با بنچمارک‌های نامرتبط دارند (بررسی ۵۶ بنچمارک روی ۵۳ مدل، arXiv 2609.08812) |
| پنهان ماندن واریانس در نمرات تجمیعی | مدل A ممکن است در مجموع مدل B را شکست دهد، اما در دامنه تخصصی شما مغلوب شود |
| دور زدن آزمون (Gaming) | مدل‌ها بیشتر برای بنچمارک‌ها بهینه‌سازی شده‌اند تا وظایف واقعی |
| اشباع‌شدگی (Saturation) | بنچمارک‌ها از قابلیت‌های مدل‌ها عقب می‌مانند: نمره GPQA Diamond برای مدل‌های پیشرو در حدود ۹۶٪ قرار دارد |

### بنچمارک‌ها چه چیزی به شما می‌گویند

<div dir="ltr">

```
Benchmark results tell you: "Model X scored 58% on Terminal-Bench 4.0"

What you need to know: "Will Model X, at the effort level I can afford,
in my harness, finish my team's real tasks without supervision?"
```

</div>

**قاعده سرانگشتی:** از بنچمارک‌ها برای غربالگری اولیه استفاده کنید، سپس ارزیابی اختصاصی خود را انجام دهید.

### خواندن جدول بنچمارک عرضه‌کننده (نوامبر ۲۰۲۶)

هر امتیاز پیش از آنکه معنایی داشته باشد، به شش برچسب نیاز دارد: **نسخه بنچمارک، بستر آزمون (harness)، سطح تلاش (effort level)، اجراکننده آن (لیدربورد یا عرضه‌کننده)، وضعیت fallback و متریک**. هر زمان که دو امتیاز به یکدیگر نزدیک بودند، **هزینه به ازای هر وظیفه (cost per task)** را نیز اضافه کنید. رونمایی‌های سپتامبر و اکتبر ۲۰۲۶ دلیل این موضوع را نشان می‌دهند:

| ادعایی که مشاهده خواهید کرد | آنچه در واقعیت سنجیده شده است |
|-----------------------------|-------------------------------|
| «Opus 5.5 در Terminal-Bench 4.0 امتیاز ۶۶.۴٪ کسب می‌کند» | اجرای خود Anthropic در سطح تلاش xhigh (گزارش‌شده توسط عرضه‌کننده، SE ±2.6). در لیدربورد tbench.ai (ورودی‌های افزوده شده در ۶ اکتبر)، Opus 5.5 با ۶۴.۸۵٪ (در حالت max) اول و Sonnet 5.5 با ۶۱.۸۲٪ (در حالت max) دوم است، جلوتر از GPT-6 Astra و GPT-6.1 Sol (با امتیاز مشترک ۵۸.۱۸٪). اجراهای خود Anthropic ترتیب مدل‌های Claude را معکوس می‌کند (Sonnet 5.5 برابر ۷۰.۶٪، Opus 5.5 برابر ۶۶.۴٪) |
| «Astra ۵۷.۹٪» در برابر «Astra ۵۸.۲٪» در Terminal-Bench 4.0 | عدد OpenAI مربوط به سطح تلاش high است؛ ۵۸.۱۸٪ مربوط به اجرای سطح تلاش max در لیدربورد است |
| «Fable 5.1 ۵۵.۸٪» در برابر «Fable 5.1 ۵۷.۹٪» | اجرای خود Anthropic در برابر ورودی با سطح تلاش max در لیدربورد (۵۷.۸۸٪) که xAI در جدول Grok 4.7 خود به آن استناد کرد |
| «GPT-6 Astra ۹۹.۹٪ در ARC-AGI-3» | بستر آزمون Provider Adapter مربوط به ARC Prize، در سطح تلاش high با هزینه ۱۸,۸۱۷ دلار. بستر استاندارد (Standard) آن در سطح تلاش max امتیاز ۶۲.۷٪ را با هزینه ۲۶,۰۹۸ دلار ثبت کرد |
| «Opus 5.5 ۸۱.۸٪ در OSWorld 2.1» | متریک نمره جزئی (partial-credit)، اجرای عرضه‌کننده. در مجموعه کامل نسخه 2.1 لیدربورد رسمی (۱۷ سپتامبر)، مدل Opus 5 در سطح تلاش max به امتیاز ۴۴.۳۳٪ دودویی و ۷۷.۶۷٪ نمره جزئی دست می‌یابد؛ آن به‌روزرسانی پیش از عرضه Opus 5.5 منتشر شده بود |
| بنچمارک HLE همراه با ابزارها: آیا Astra پیشتاز است یا Opus 5.5؟ | هر دو. در HLE-Diamond (شامل ۱,۰۰۰ سوال پاکسازی‌شده): Astra با ۸۲.۹٪ و Opus 5.5 با ۷۳.۹٪. در جدول کامل HLE ارائه شده توسط Anthropic: مدل Opus 5.5 با ۶۷.۷٪ و Astra با ۵۷.۲٪. مجموعه داده و اجراکننده، ترتیب را معکوس می‌کنند |
| «سه مدل با ۷۴٪ در DeepSWE v1.1 مساوی شده‌اند» | نرخ قبولی یکسان با هزینه ۲.۳۶ دلار به ازای هر وظیفه (Gemini 3.8 Flash، در حالت high)، ۴.۴۳ دلار (GPT-6 Astra، در حالت xhigh) و ۱۱.۸۴ دلار (Claude Opus 5، در حالت max) |
| «Opus 5.5 در شاخص هوش AA امتیاز ۵۸ می‌گیرد» در برابر «۵۹» | ۵۸ مربوط به Index v5.0 (اعلام‌شده در ۲۷ اکتبر) در سطح تلاش max به همراه fallback تدابیر محافظتی است؛ ۵۹ مربوط به v5.0.1 (در ۳ نوامبر) است که تمام مدل‌ها را مجدداً روی CritPt v2 درجه‌بندی کرد و Gemini 4 Carbon را (که توسعه‌دهندگان نمی‌توانند به آن فراخوانی API بزنند) در امتیاز ۶۰ قرار داد. نمرات سری v4.x در مقیاس متفاوتی هستند و قابل مقایسه نیستند، حتی اگر یک عدد به طور اتفاقی یکسان باشد |
| «Sonnet 5.5 امتیاز ۵۴ می‌گیرد» در برابر «Sonnet 5.5 امتیاز ۴۱ می‌گیرد» | هر دو در AA v5.0: ۵۴ در سطح تلاش max و ۴۱ در سطح تلاش high. تغییر یک تنظیم تلاش، آن را ۱۳ امتیاز جابه‌جا کرد؛ GPT-6.1 Terra نیز از ۵۱ در حالت max به ۳۸ در حالت پیش‌فرض `medium` تغییر می‌کند |
| «Haiku 5.5 امتیاز ۷۲.۴٪ در OSWorld 2.1 می‌گیرد» | زیرمجموعه آفلاین Anthropic با نمره جزئی، گزارش‌شده توسط عرضه‌کننده. این عدد متریک دودویی لیدربورد نیست و با نمرات مجموعه کامل قابل مقایسه نمی‌باشد |

قاعده‌ای که در پی می‌آید: **تنها اعدادی قابل مقایسه‌اند که دارای بستر آزمون یکسان، سطح تلاش یکسان و اجراکننده یکسان باشند.** عدد اعلام‌شده توسط عرضه‌کننده، ادعایی درباره بهترین پیکربندی خود عرضه‌کننده است، نه یک پیش‌بینی برای سناریوی شما. [فصل بنچمارک‌ها](../14-evaluation-and-observability/03-benchmarks-and-leaderboards.md#harness-and-scaffold-variance) واریانس بستر آزمون را با عمق بیشتری پوشش می‌دهد.

---

## ابعاد ارزیابی

### بعد ۱: عملکرد وظیفه (Task Performance)

| نوع وظیفه | رویکرد ارزیابی | متریک کلیدی |
|-----------|----------------|-------------|
| **کدنویسی خودکار** | بنچمارک SWE-Bench Pro v2 (مجموعه خصوصی)، DeepSWE v1.1، Terminal-Bench 4.0 و سپس مخازن خودتان | درصد وظایف حل‌شده، هزینه به ازای هر وظیفه حل‌شده |
| **برنامه‌ریزی بلندمدت** | تست حلقه ایجنتی (tau3-bench v1.0.1، Agents' Last Exam) | نرخ موفقیت در برنامه‌های بیش از ۱۰ مرحله |
| **استفاده از رایانه** | OSWorld 2.0 | ابتدا تکمیل دودویی، سپس نمره جزئی |
| **عمق استدلال** | پیمایش سطح تلاش (از low تا max) | دقت و Tokenها در هر سطح تلاش |
| **معماری RAG با کانتکست طولانی** | فراخوانی چندسوزنی و استدلالی (MRCR، AA-LCR) تا حداکثر ۱ میلیون Token | فراخوانی و استدلال میان‌سندی در عمق |
| **چندوجهی بومی** | تصویر/صوت/متن درهم‌تنیده | دقت همگام‌سازی بین مدالیته‌ها |

### بعد ۲: تسلط ایجنتی (Agentic Mastery)

مدل تا چه حد در استفاده از ابزارها و دنبال کردن دستورالعمل‌های چندمرحله‌ای خوب عمل می‌کند؟

<div dir="ltr">

```python
def evaluate_agentic_flow(agent, task_environment):
    """
    Measure success on 'Autonomous Agent' tasks:
    1. Plan generation
    2. Tool selection accuracy
    3. Error recovery
    4. Feedback loop utilization
    """
    results = []
    for scenario in task_environment.scenarios:
        traj = agent.run(scenario.goal)
        results.append({
            "success": traj.reached_goal,
            "steps": len(traj.steps),
            "tool_errors": traj.count_invalid_tool_calls()
        })
    return aggregate(results)
```

</div>

وضعیت نهایی را با بررسی‌های تازه و ایزوله‌شده ارزیابی کنید، نه بر اساس گزارش خود Agent، و تا حد امکان شبکه ساندباکس را صرفاً به Endpoint مدل محدود و قفل کنید. SWE-Bench Pro v2 اکنون هر دو کار را انجام می‌دهد (یک ساندباکس با شبکه قفل‌شده به‌علاوه ارزیابی مجدد هر diff روی یک ایمیج دست‌نخورده)، و این ارزیابی مجدد مچ یک مدل پیشرو را در جعل نسخه یک ماژول Go گرفت.

### بعد ۳: قابلیت اطمینان استدلال (Reasoning Reliability)

تفکر اکنون مانند یک درجه تنظیم پیوسته است، نه یک کلید قطع و وصل. Claude Opus 5.5 نمی‌تواند تفکر را غیرفعال کند، پایین‌ترین تنظیم Sonnet 5.5 مقدار `between_tools` است، و GPT-6 Astra هیچ سطح تلاش `none` ندارد. پرسش این است که وظیفه شما به کدام **سطح تلاش (effort level)** نیاز دارد:

| سطح تلاش (نمونه) | دقت (ریاضی) | دقت (کدنویسی) | میانگین تاخیر (Latency) | واحدهای Token / خروجی |
|------------------|-------------|---------------|-------------------------|-----------------|
| **Low** | ۷۸٪ | ۷۴٪ | ۲.۱ ثانیه | ۶۰۰ |
| **Medium** | ۸۸٪ | ۸۴٪ | ۵.۸ ثانیه | ۱,۵۰۰ |
| **High** | ۹۳٪ | ۸۸٪ | ۱۲.۵ ثانیه | ۲,۸۰۰ |
| **Max** | ۹۴٪ | ۸۹٪ | ۳۱ ثانیه | ۷,۰۰۰ |

تنظیمات پیش‌فرض تغییر می‌کنند: Opus 5.5 و Haiku 5.5 به طور پیش‌فرض روی `medium` هستند، جایی که Opus 5 از `high` استفاده می‌کرد؛ GPT-6.1 Sol و GPT-6.1 Terra به طور پیش‌فرض روی `medium` قرار دارند، و Sonnet 5.5 در API به طور پیش‌فرض روی `high` است اما در Claude Code روی `medium` تنظیم شده است. سطح تلاش را هم در ارزیابی‌ها و هم در پروداکشن به صراحت تثبیت (pin) کنید. یک ارزیابی با حداکثر تلاش، استقرار (Deployment) با تلاش متوسط را پیش‌بینی نمی‌کند.

### کالیبراسیون استدلال (Reasoning Calibration)

**مسئله «بیش‌ازحد فکر کردن»:**
مدل‌ها اغلب بیش از ۲۰۰۰ Token «تفکر» را برای سوالی صرف می‌کنند که می‌شد با ۱۰ Token به آن پاسخ داد (مثلاً «۲+۲ چند می‌شود؟»).

**نکته ظریف در سطح مهندسی ارشد:**
مدل‌ها را بر اساس **کارایی منطق (Logic Efficiency)** ارزیابی کنید: `Accuracy / (Inference Tokens)`.
سیستم‌های پروداکشن از **داوری مدل (Model Arbitration)** استفاده می‌کنند: یک مدل کوچک و ارزان (GPT-6 Luna، Claude Haiku 5.5 در Promptهای زیر ۱۰۰ هزار Token، Gemini 3.8 Flash در سطح تفکر پایین) پرس‌وجو را دسته‌بندی کرده و سطح تلاش یا مدل را برای فراخوانی اصلی برمی‌گزیند. در مدل‌هایی که تفکر در آن‌ها خاموش نمی‌شود، وظیفه داور انتخاب بین `low` و `high` است که همچنان از جریمه ۱۰ برابری تاخیر (Latency) و هزینه در پرس‌وجوهای ساده جلوگیری می‌کند.

معیار **Tokenها به ازای هر وظیفه** را بسنجید، نه فقط دقت را. مدل‌ها در اینجا تفاوت‌های چند برابری دارند: Artificial Analysis اندازه‌گیری کرد که GPT-6 Astra در هر وظیفه کدنویسی حدود یک‌سوم Tokenهای GPT-5.6 Sol را مصرف می‌کند، در حالی که Muse Spark 1.3 نسبت به 1.2 پرحرف‌تر شد، بنابراین هزینه هر وظیفه آن افزایش یافت هرچند قیمت هر Token آن تغییری نکرد.

### بعد ۴: فراخوانی کانتکست (Context Recall)

اکنون که پنجره‌های ۱ میلیون Tokenای به استاندارد تبدیل شده‌اند (Claude 4.6 به بعد، GPT-6 با ۱.۰۵ میلیون، Gemini 3.8 Flash و Gemini 4 Argon با ۱,۰۴۸,۵۷۶)، آزمون ساده «سوزن در انبار کاه» دیگر کافی نیست. ما امروزه **استدلال زمینه‌ای (Contextual Reasoning)** را در کل پنجره اندازه می‌گیریم.

| متریک | نحوه سنجش | هدف |
|-------|-----------|-----|
| **فراخوانی پنجره (Window Recall)** | فراخوانی فکت‌ها در عمق ۹۰ درصدی پنجره | > ۹۸٪ |
| **استدلال میان‌سندی (Cross-Doc Reasoning)** | منطقی که سند A (موقعیت 10k) را به سند B (موقعیت 900k) متصل می‌کند | > ۹۰٪ |
| **مقاومت در برابر نویز زمینه‌ای (Contextual Noise Resistance)** | دقت زمانی که ۹۰٪ پنجره از محتوای پرکننده نامرتبط تشکیل شده باشد | > ۹۵٪ |
| **انسجام خروجی طولانی (Long-Output Coherence)** | سازگاری در سرتاسر ۶۴ تا ۱۲۸ هزار Token تولیدشده (سقف فعلی خروجی در مدل‌های Claude 5.x و GPT-6 برابر ۱۲۸ هزار و در Gemini 3.8 Flash برابر ۶۵,۵۳۶ است؛ Gemini 4 Argon به طور پیش‌فرض ۶۵,۵۳۶ است و تنها از طریق پروتکل ادامه دیکود طولانی خود به حدود ۱ میلیون می‌رسد) | وابسته به وظیفه |

هزینه را در کنار فراخوانی ثبت کنید. در مدل‌های OpenAI ارسال یک Prompt بالای ۲۷۲ هزار Token کل درخواست را با نرخ‌های کانتکست طولانی محاسبه می‌کند، و در Claude Haiku 5.5 ارسال Prompt بالای ۱۰۰ هزار Token هزینه آن را ۵ برابر می‌کند؛ بنابراین مدلی که در ۸۰۰ هزار Token فراخوانی خوبی دارد ممکن است از نظر هزینه به RAG ببازد، و یک مدل ارزان می‌تواند در ۱۰۱ هزار Token دیگر ارزان نباشد. همین امر در مورد خروجی نیز صدق می‌کند: دیکود طولانی Argon اجازه می‌دهد یک فراخوانی منطقی جایگزین حلقه تولید تکه‌تکه‌شده (chunked generation loop) شود، اما تنها پس از آنکه انسجام و هزینه را در آن طول سنجیده باشید.

---

## ارزیابی داخلی مبتنی بر Elo

**فراتر رفتن از معیارهای ارزیابی ایستا.**
روبریم‌ها (مقیاس‌های ۱ تا ۵) مستعد «خستگی داور» و «انحراف امتیاز» هستند. سیستم‌های امروزی از **Elo جفتی (Pairwise Elo)** برای مجموعه‌های طلایی داخلی استفاده می‌کنند.

**گردش کار (Workflow):**
۱. **مقایسه دوشادوش کور (Blind Side-by-Side):** مدل A و مدل B برای یک پرس‌وجوی یکسان پاسخ تولید می‌کنند.
۲. **داور (The Judge):** یک مدل قوی (Claude Opus 5.5، GPT-6 Astra یا انسان) برنده را انتخاب می‌کند. هر جفت را دو بار با جابه‌جایی موقعیت‌ها اجرا کنید؛ در اکثر داورهای پیشرو دیگر نمی‌توانید پارامتر دما (temperature) را ثابت نگه دارید، بنابراین واریانس داور را اندازه بگیرید نه اینکه آن را نادیده فرض کنید.
۳. **به‌روزرسانی Elo:** لیدربورد داخلی را به‌روزرسانی کنید.

<div dir="ltr">

```python
def update_elo(winner_elo, loser_elo, k=32):
    expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
    new_winner_elo = winner_elo + k * (1 - expected_winner)
    new_loser_elo = loser_elo + k * (0 - (1 - expected_winner))
    return new_winner_elo, new_loser_elo
```

</div>

**چرا این روش برتر است:** این شیوه یک رتبه‌بندی **نسبی** ارائه می‌دهد که در برابر تغییرات رفتار داور یا نسخه‌بندی مدل‌ها بسیار مقاوم‌تر است.

**هزینه داوری اکنون یک تصمیم در طراحی است.** داورهای مدل تصمیمی که به جای متن، امتیازات کالیبره‌شده بازمی‌گردانند (مانند Jev از شرکت TypeSafe)، بین ۱۶ تا ۳۲۵ برابر ارزان‌تر از داورهای روبریم مبتنی بر LLM هستند و دقت آن‌ها حداکثر در ۸ مورد از ۲۷ مقایسه جفتی تفاوت معناداری داشت (arXiv 2609.29769). اما در خطاهایی که مدل تصمیمی با بالاترین اطمینان مرتکب می‌شد، حدود ۹۶٪ از قضاوت‌های LLM همان پاسخ اشتباه را تکرار کردند و آبشارهای داوری حداکثر ۲.۷ امتیاز بهبود ایجاد کردند. داورهای ارزان‌قیمت برای معیارهای چک‌لیست دودویی مناسب هستند؛ اما داور دوم از همان خانواده استقلال رأی ایجاد نمی‌کند.

---

## ساخت ارزیابی‌های سفارشی

### گام ۱: تعریف معیارهای ارزیابی

<div dir="ltr">

```python
evaluation_criteria = {
    "correctness": {
        "weight": 0.4,
        "description": "Is the answer factually correct?",
        "scale": [1, 2, 3, 4, 5],
        "rubric": {
            5: "Completely correct, no errors",
            4: "Mostly correct, minor issues",
            3: "Partially correct, some errors",
            2: "Mostly incorrect",
            1: "Completely wrong or nonsensical"
        }
    },
    "relevance": {
        "weight": 0.3,
        "description": "Does the answer address the question?",
        "scale": [1, 2, 3, 4, 5]
    },
    "completeness": {
        "weight": 0.2,
        "description": "Are all parts of the question addressed?",
        "scale": [1, 2, 3, 4, 5]
    },
    "conciseness": {
        "weight": 0.1,
        "description": "Is the answer appropriately concise?",
        "scale": [1, 2, 3, 4, 5]
    }
}
```

</div>

### گام ۲: ایجاد مجموعه آزمون (Test Set)

<div dir="ltr">

```python
test_set = [
    {
        "id": "q001",
        "query": "What is the refund policy for subscription cancellation?",
        "context": "[relevant documentation]",
        "ground_truth": "Full refund within 30 days, prorated after",
        "difficulty": "easy",
        "category": "policy"
    },
    {
        "id": "q002",
        "query": "How do I integrate the API with a Python async application?",
        "context": "[API documentation]",
        "ground_truth": "[expected code pattern]",
        "difficulty": "medium",
        "category": "technical"
    },
    # ... 50-100+ test cases
]
```

</div>

**راهنمای مجموعه آزمون:**
- پوشش تمام موارد کاربرد اصلی
- شامل نمونه‌های آسان، متوسط و دشوار
- ایجاد تعادل بین دسته‌بندی‌ها
- در نظر گرفتن حالت‌های مرزی (edge cases)
- برخورداری از پاسخ‌های مرجع (ground truth) مشخص
- استخراج از ترافیک واقعی پروداکشن در صورت امکان، به گونه‌ای که شبیه یک آزمون تصنعی نباشد

### گام ۳: پیاده‌سازی ارزیابی

<div dir="ltr">

```python
class ModelEvaluator:
    def __init__(self, models: list[str], test_set: list[dict]):
        self.models = models
        self.test_set = test_set
        self.results = {}
    
    def evaluate_all(self):
        for model in self.models:
            self.results[model] = self.evaluate_model(model)
        return self.results
    
    def evaluate_model(self, model: str) -> dict:
        scores = []
        latencies = []
        
        for case in self.test_set:
            start = time.time()
            response = self.generate(model, case)
            latency = time.time() - start
            latencies.append(latency)
            
            # Score using LLM judge or human
            score = self.score_response(case, response)
            scores.append(score)
        
        return {
            "mean_score": mean(scores),
            "score_by_category": self.group_by_category(scores),
            "p50_latency": percentile(latencies, 50),
            "p99_latency": percentile(latencies, 99)
        }
    
    def score_response(self, case: dict, response: str) -> float:
        # Option 1: LLM-as-judge
        return self.llm_judge(case, response)
        
        # Option 2: Exact match
        # return exact_match(response, case["ground_truth"])
        
        # Option 3: Semantic similarity
        # return cosine_sim(embed(response), embed(case["ground_truth"]))
```

</div>

### گام ۴: استفاده از LLM به عنوان داور (LLM-as-Judge)

<div dir="ltr">

```python
def llm_judge(case: dict, response: str) -> dict:
    prompt = f"""Evaluate this response to a customer query.

Query: {case['query']}
Expected Answer: {case['ground_truth']}
Model Response: {response}

Rate the response on these criteria (1-5 scale):
1. Correctness: Is it factually accurate?
2. Relevance: Does it answer the question?
3. Completeness: Are all aspects covered?
4. Conciseness: Is it appropriately brief?

Output JSON:
{{"correctness": X, "relevance": X, "completeness": X, "conciseness": X, "reasoning": "..."}}
"""
    
    result = judge_model.generate(prompt)
    return parse_json(result)
```

</div>

---

## دام‌های رایج در ارزیابی

### دام ۱: مجموعه آزمون کوچک (Small Test Set)

**مشکل:** ۲۰ مورد آزمون (test case) برای یک مقایسه قابل اتکا کافی نیست.

**راه‌حل:** برای بیش از ۱۰۰ مورد آزمون هدف‌گذاری کنید که بر اساس میزان دشواری و دسته‌بندی، طبقه‌بندی (stratified) شده باشند.

### دام ۲: داده واقعیت زمینیِ مبهم (Ambiguous Ground Truth)

**مشکل:** پاسخ‌های «منطقی» و قابل قبول، به اشتباه نادرست علامت‌گذاری می‌شوند.

<div dir="ltr">

```
Query: "What is the capital of Australia?"
Ground truth: "Canberra"
Model answer: "The capital of Australia is Canberra."
Exact match: FAIL (but clearly correct)
```

</div>

**راه‌حل:** به‌جای تطابق دقیق (exact match)، از تطابق معنایی (semantic matching) یا داور LLM (LLM judge) استفاده کنید.

### دام ۳: نشت مجموعه ارزیابی (Evaluation Set Leakage)

**مشکل:** استفاده از موارد آزمون یکسان برای توسعه و ارزیابی.

**راه‌حل:** یک مجموعه آزمون مجزا و کنارگذاشته‌شده (held-out) نگه دارید که هرگز از آن برای تنظیم Prompt (Prompt tuning) استفاده نکنید.

### دام ۴: نادیده گرفتن واریانس (Ignoring Variance)

**مشکل:** اجرای هر آزمون فقط برای یک بار، تصادفی‌بودن (randomness) رفتار مدل را نادیده می‌گیرد.

**راه‌حل:** هر مورد آزمون را حداقل سه بار در همان تنظیمات سطح تلاش (effort) محیط عملیاتی (production) اجرا کنید و فاصله‌های اطمینان (confidence intervals) را گزارش نمایید. پارامتر دما (Temperature) دیگر در اکثر مدل‌های مرز دانشی (frontier) یک اهرم تنظیم به شمار نمی‌رود: نسخه API مورخ `2026-10-21` در Claude که هر هشت نسخه اصلی جدید SDK و CLI شرکت Anthropic آن را به‌طور پیش‌فرض ارسال می‌کنند، برای هر مقداری از `temperature`، `top_p` یا `top_k` در تمام مدل‌ها خطای 400 بازمی‌گرداند (نسخه‌های قبلی نیز مقادیر غیرپیش‌فرض را در Claude 4.7 و نسخه‌های پس از آن رد می‌کنند)؛ شرکت Google پارامتر دما را در Gemini API منسوخ کرده است؛ و GPT-6 Astra نیز آن را نمی‌پذیرد. واریانس چیزی است که باید آن را اندازه بگیرید، نه آنکه با تنظیم پارامترها نادیده‌اش بگیرید یا حذفش کنید.

### دام ۵: بی‌توجهی به هزینه (Cost Blindness)

**مشکل:** بهترین مدل ۱۰ برابر گران‌تر است.

**راه‌حل:** همواره هزینه تعدیل‌شده بر اساس کیفیت (quality-adjusted cost) را به ازای هر تسک گزارش دهید، نه به ازای هر Token. تساوی سه‌جانبه DeepSWE v1.1 در امتیاز ۷۴٪، دامنه‌ای از ۲.۳۶ دلار تا ۱۱.۸۴ دلار به ازای هر تسک را در بر می‌گیرد.

<div dir="ltr">

```python
def quality_adjusted_cost(model_results):
    return {
        model: {
            "quality": results["mean_score"],
            "cost_per_1k": results["cost_per_1k_queries"],
            "quality_per_dollar": results["mean_score"] / results["cost_per_1k"]
        }
        for model, results in model_results.items()
    }
```

</div>

### دام ۶: ارزیابی سیستمی متفاوت از آنچه به مرحله استقرار می‌رسانید

**مشکل:** ارزیابی در حداکثر سطح تلاش (max effort)، در بستر آزمایشی (harness) اختصاصی ارائه‌دهنده، با مکانیزم بازگشت ایمن (safeguard fallback) به مدلی دیگر، یا در برابر مدلی انجام شده است که از آن زمان تاکنون تحت همان شناسه تغییر یافته است.

**راه‌حل:** تنظیمات سطح تلاش (effort)، بستر آزمایشی (harness)، ابزارها و مکانیزم‌های جایگزین (fallback) را دقیقاً مطابق با محیط عملیاتی (production) تنظیم کنید، و ارزیابی‌ها را با هر تغییر سمت ارائه‌دهنده — و نه فقط تغییر در شناسه مدل — مجدداً اجرا نمایید. OpenAI در ۲۵ سپتامبر ۲۰۲۶ یک باگ درک تصویر را در GPT-6 Sol و Luna بدون تغییر شناسه مدل برطرف کرد و از مشتریان خواست ارزیابی‌های مربوط به تصویر را مجدداً اجرا کنند. نام‌های قدیمی `deepseek-v4-flash` در DeepSeek اکنون مدل V4.1-Flash را سرویس‌دهی می‌کنند، و `deepseek-flash` در ۱۷ اکتبر به بیلد V4.1-Flash-1017 تغییر یافت. Google از ۸ اکتبر به این سو درخواست‌های `gemini-3.7-flash` را با Gemini 3.8 Flash پاسخ می‌دهد؛ بنابراین ارزیابیِ تثبیت‌شده (pinned) روی 3.7 Flash اکنون در عمل مدل متفاوتی را می‌سنجد.

### دام ۷: آگاهی از ارزیابی (Eval Awareness)

**مشکل:** مدل‌ها هنگامی که متوجه آزمون بودن ورودی شوند، رفتار متفاوتی از خود نشان می‌دهند. Anthropic گزارش داده است که Opus 5.5 در ۳۶٪ از متن‌های بازرسی (audit transcripts) آگاهی از ارزیابی نشان داده است، در حالی که این میزان در رونوشت‌های داخلی Claude Code تنها ۰.۴٪ بوده است.

**راه‌حل:** مجموعه‌های ارزیابی را به‌جای استفاده از Promptهای آشکارا ساختگی، بر پایه ترافیک واقعی (و پاک‌سازی‌شده از داده‌های حساس) محیط عملیاتی و اجراهای حالت سایه (shadow-mode) بسازید؛ و در صورت عدم توافق، به سیگنال‌های محیط عملیاتی وزن و اعتبار بیشتری نسبت به امتیازهای آفلاین بدهید.

---

## فرآیند عملی ارزیابی

### هفته اول: راه‌اندازی و غربال‌گری اولیه

<div dir="ltr">

```
Day 1-2: Define evaluation criteria and create test set
Day 3-4: Benchmark 4-6 candidate models at the effort level you can afford to ship
Day 5: Analyze results, filter to top 2-3
```

</div>

### هفته دوم: ارزیابی عمیق

<div dir="ltr">

```
Day 1-2: Expand test set for top candidates
Day 3: Test edge cases and robustness
Day 4: Measure latency and throughput
Day 5: Calculate total cost of ownership
```

</div>

### هفته سوم: اعتبارسنجی در محیط عملیاتی

<div dir="ltr">

```
Day 1-2: Shadow mode deployment
Day 3-4: A/B test if traffic allows
Day 5: Final decision and documentation
```

</div>

### الگوی تصمیم‌گیری (Decision Template)

<div dir="ltr">

```markdown
## Model Evaluation Report

### Candidates Evaluated
- Model A: GPT-6 Sol (effort: medium)
- Model B: Claude Sonnet 5.5 (effort: high, API default)
- Model C: GLM-5.3-Flash (API)

### Evaluation Results

| Metric | Model A | Model B | Model C |
|--------|---------|---------|---------|
| Overall Score | 4.2/5 | 4.3/5 | 3.9/5 |
| Category 1 | ... | ... | ... |
| P50 Latency | 4.1s | 5.2s | 3.6s |
| Tokens per task (2,600 in + output incl. reasoning) | 3,500 | 3,700 | 4,000 |
| Cost/1K queries (list price) | $14.20 | $16.20 | $1.09 |

### Recommendation
Model B (Claude Sonnet 5.5) for quality-critical paths
Model C (GLM-5.3-Flash) for high-volume, cost-sensitive paths

### Rationale
[Detailed reasoning, including harness, effort and retirement dates]
```

</div>

---

## آزمون A/B مدل‌ها (A/B Testing Models)

### چه زمانی باید آزمون A/B انجام داد

- ترافیک بالا (بیش از ۱۰۰۰ پرس‌وجو در روز)
- معیارهای موفقیت مشخص و شفاف
- ریسک پذیرفتنی در نوسان کیفیت
- نیاز به اعتبارسنجی در محیط عملیاتی

### طراحی آزمون A/B

<div dir="ltr">

```python
import hashlib

class ModelABTest:
    def __init__(self, model_a: str, model_b: str, traffic_split: float = 0.5):
        self.model_a = model_a
        self.model_b = model_b
        self.traffic_split = traffic_split
        self.results = {"a": [], "b": []}
    
    def route_request(self, request_id: str) -> str:
        # Deterministic routing for consistency. Python's built-in hash() is
        # salted per process for strings, so use a stable digest instead.
        digest = hashlib.sha256(request_id.encode()).digest()
        hash_val = int.from_bytes(digest[:8], "big") % 100
        if hash_val < self.traffic_split * 100:
            return self.model_a
        return self.model_b
    
    def record_outcome(self, request_id: str, metrics: dict):
        model = self.route_request(request_id)
        bucket = "a" if model == self.model_a else "b"
        self.results[bucket].append(metrics)
    
    def analyze(self):
        return {
            "model_a": {
                "name": self.model_a,
                "mean_score": mean([r["score"] for r in self.results["a"]]),
                "sample_size": len(self.results["a"])
            },
            "model_b": {
                "name": self.model_b,
                "mean_score": mean([r["score"] for r in self.results["b"]]),
                "sample_size": len(self.results["b"])
            },
            "p_value": self.calculate_significance()
        }
```

</div>

هنگامی که مدل‌ها حالت (state) گفتگو را در طول نوبت‌ها حفظ می‌کنند، مسیریابی را بر اساس یک واحد پایدار (شناسه کاربر یا شناسه گفتگو) انجام دهید، نه شناسه درخواست (request ID). در Claude Fable 5.1،‏ Opus 5.5،‏ Sonnet 5.5 و Haiku 5.5، بلوک‌های تفکر (thinking blocks) به مدلی که آن‌ها را تولید کرده است وابسته (bound) هستند (و در Sonnet 5.5 و Haiku 5.5 به حساب کاربری تولیدکننده وابسته هستند)؛ بنابراین جابه‌جا کردن یک گفتگو بین بازوهای آزمون در میانه مسیر، بدون اعلام خطا زنجیره استدلال را حذف می‌کند.

### معیارهایی که باید رصد شوند

| نوع معیار | نمونه‌ها |
|---|---|
| کیفیت (Quality) | امتیازهای کاربران، بررسی تخصصی، داور LLM |
| تعامل (Engagement) | نرخ کلیک (CTR)، زمان سپری‌شده در صفحه، پرس‌وجوهای پیگیری |
| کسب‌وکار (Business) | نرخ تبدیل، ارجاع به پشتیبانی سطح بالاتر (escalation)، نرخ حل مسئله |
| عملیاتی (Operational) | تاخیر (Latency)، خطاها، هزینه به ازای هر تسک، نرخ رد درخواست (refusal rate) |

---

## پرسش‌های مصاحبه

### پرسش: چگونه مدل‌ها را برای یک چت‌بات پشتیبانی مشتری ارزیابی می‌کنید؟

**پاسخ قوی:**
من ارزیابی را در چند لایه ساختاردهی می‌کنم:

**۱. ارزیابی آفلاین (۸۰٪ تلاش):**
- ایجاد مجموعه آزمون از تیکت‌های واقعی پشتیبانی (بیش از ۲۰۰ مورد)
- پوشش تمام دسته‌بندی‌ها: صورت‌حساب، فنی، مرجوعی، عمومی
- در بر گرفتن سطوح دشواری آسان، متوسط و سخت
- سنجش: دقت، مفید بودن، ایمنی

**۲. روش ارزیابی:**
- استفاده از داوری مبتنی بر LLM (LLM-as-judge) برای معیارهای ذهنی و کیفی
- بازبینی انسانی برای نمونه‌ای از داده‌ها (۲۰٪)
- پایش میزان پیروی از دستورالعمل‌ها (فرمت، طول پاسخ)

**۳. معیارها:**

<div dir="ltr">

```python
metrics = {
    "resolution_accuracy": "Does answer solve the problem?",
    "safety": "No harmful/wrong advice?", 
    "tone": "Professional and empathetic?",
    "escalation_appropriate": "Knows when to involve human?"
}
```

</div>

**۴. اعتبارسنجی در محیط عملیاتی:**
- حالت سایه (Shadow mode): اجرای مدل جدید و مقایسه خروجی‌ها
- آزمون A/B: هدایت ۱۰٪ از ترافیک به مدل جدید
- رصد و پایش: شاخص رضایت مشتری (CSAT)، نرخ ارجاع به پشتیبانی انسانی (escalation rate)، زمان حل مسئله

### پرسش: استفاده از MMLU برای مقایسه مدل‌ها در مورد کاربرد خاص شما چه اشکالی دارد؟

**پاسخ قوی:**
بنچمارک MMLU برای موارد کاربرد خاص دارای چندین مشکل اساسی است:

**۱. عدم تطابق دامنه (Domain mismatch):** بنچمارک MMLU دانش آکادمیک را می‌سنجد، در حالی که بات پشتیبانی مشتری من به دانش محصول نیاز دارد.

**۲. عدم تطابق ساختار (Format mismatch):** بنچمارک MMLU چندگزینه‌ای است، در حالی که مورد کاربرد من تولید متن آزاد (free-form generation) است.

**۳. آلودگی داده‌ها (Contamination):** مدل‌ها ممکن است با سوالات MMLU آموزش دیده باشند.

**۴. تجمیع داده‌ها واریانس را پنهان می‌کند:** ممکن است مدل A در مجموع امتیاز MMLU از مدل B پیشی بگیرد، اما در دسته‌بندی‌های خاصی که برای من اهمیت دارند شکست بخورد.

**۵. عدم آزمون کانتکست:** بنچمارک MMLU توانمندی‌های RAG یا کانتکست طولانی (long-context) را نمی‌سنجد.

**۶. اشباع‌شدگی (Saturation):** مدل‌های مرز دانشی (frontier) در بالاترین امتیازات این بنچمارک تجمیع شده‌اند، بنابراین دیگر تمایزی میان آن‌ها ایجاد نمی‌کند. موسسه Artificial Analysis اکنون ارزیابی‌های MMLU-Pro،‏ GPQA Diamond و موارد مشابه را به عنوان بنچمارک‌های قدیمی (legacy) و خارج از شاخص فعلی خود دسته‌بندی می‌کند.

**رویکرد بهتر:**
- استفاده از بنچمارک‌ها برای غربال‌گری اولیه (جهت صرفه‌جویی در زمان)، با اولویت دادن به بنچمارک‌های مقاوم در برابر آلودگی داده‌ها و دارای بخش‌های خصوصی (private splits)
- ساخت ارزیابی سفارشی برای تصمیم‌گیری نهایی
- آزمون روی داده‌های واقعیِ مورد کاربرد
- گنجاندن معیارهای عملیاتی (تاخیر (Latency)، هزینه به ازای هر تسک)

### پرسش: ارائه‌دهنده‌ای ادعا می‌کند که مدل جدیدش در ARC-AGI-3 امتیاز ۹۹.۹٪ را کسب کرده است. بستر آزمایشی (harness) اختصاصی ARC Prize برای همان مدل، امتیاز ۶۲.۷٪ را نشان می‌دهد. شما به کدام عدد استناد می‌کنید؟

**پاسخ قوی:**
هر دو عدد واقعی هستند؛ آن‌ها دو سیستم کاملاً متفاوت را اندازه‌گیری می‌کنند. مجموعه ARC Prize صحت هر دو عدد را برای GPT-6 Astra تایید کرده است. امتیاز ۹۹.۹٪ روی بستر تطبیق‌دهنده ارائه‌دهنده (Provider Adapter harness) اجرا شده است که حالت استدلال مات (opaque reasoning state) مدل را میان درخواست‌ها حفظ می‌کند؛ این آزمون در سطح تلاش بالا (high effort) و با هزینه‌ای در حدود ۱۹ هزار دلار انجام شد. امتیاز ۶۲.۷٪ روی بستر استاندارد (Standard harness) اجرا شده است، یعنی یک رابط بی‌طرف نسبت به ارائه‌دهنده (provider-neutral) که در آن مدل تنها یادداشت‌هایی را نگه می‌دارد که خودش انتخاب کرده بنویسد؛ این آزمون در حداکثر سطح تلاش (max effort) و با هزینه‌ای در حدود ۲۶ هزار دلار انجام شد.

**کدام‌یک رفتار سیستم من را پیش‌بینی می‌کند:**
- اگر ایجنت من روی API و بستر آزمایشی حالت‌مند (stateful) ارائه‌دهنده اجرا شود (برای مثال در OpenAI، از طریق Responses API که حالت استدلال را در طول نوبت‌ها منتقل می‌کند)، عدد تطبیق‌دهنده (adapter) به پیکربندی من نزدیک‌تر است.
- اگر من از یک بستر بی‌طرف نسبت به ارائه‌دهنده استفاده کنم، درخواست‌ها را میان چند ارائه‌دهنده مسیریابی نمایم، یا کانتکست را در هر نوبت بازسازی کنم، عدد استاندارد عدد صادقانه و واقعی است. در هرگونه مقایسه میان چند ارائه‌دهنده، حتماً باید از این عدد استفاده شود.

**نتیجه‌ای که از این شکاف می‌گیرم:** حدود ۳۷ امتیاز اختلاف میان دو اجرای حاصل از یک مجموعه وزنِ یکسان وجود دارد، و عامل این تمایز، اسکلت نرم‌افزاری و چارچوب اجرا (scaffold) است (امتیاز پایین‌تر حتی در سطح تلاش بالاتری اجرا شده بود). بنابراین، من ارزیابی را در بستر آزمایشی خودم و در سطح تلاش مد نظر خودم انجام می‌دهم، و نحوه مدیریت حالت (state) — اینکه چه چیزی میان نوبت‌ها باقی می‌ماند و آیا جابه‌جایی اضطراری (failover) آن را حذف می‌کند یا خیر — را به عنوان بخشی از تصمیم‌گیری در انتخاب مدل در نظر می‌گیرم. همچنین هزینه به ازای هر تسک را نیز ثبت می‌کنم: در اینجا، امتیازی که بالاتر بود حتی هزینه کمتری داشت.

---

## منابع

- Zheng et al. "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" (2023)
- پلتفرم Arena (که قبلاً LMArena / LMSYS Chatbot Arena نام داشت): https://arena.ai/
- متدولوژی شاخص هوش در Artificial Analysis: https://artificialanalysis.ai/methodology/intelligence-benchmarking
- گزارش ARC Prize درباره GPT-6 Astra در ARC-AGI-3: https://arcprize.org/blog/astra
- جدول رده‌بندی OSWorld 2.0 (XLANG): https://osworld-v2.xlang.ai/
- جدول رده‌بندی Terminal-Bench 4.0: https://www.tbench.ai/leaderboard/terminal-bench/4.0
- مقاله «Maintaining Benchmarks Against Increasingly Capable Agents» (شناسه arXiv 2609.34262)
- مقاله «JEV vs. LLMs as Rubric Judges» (شناسه arXiv 2609.29769)
- بنچمارک HELM: https://crfm.stanford.edu/helm/
- ارزیابی LMSys: https://github.com/lm-sys/FastChat/tree/main/fastchat/llm_judge
- ابزار OpenAI Evals (فریم‌ورک متن‌باز؛ پلتفرم میزبانی‌شده Evals در ۳۰ نوامبر ۲۰۲۶ خاموش می‌شود): https://github.com/openai/evals

---

*قبلی: [طبقه‌بندی مدل‌ها](01-model-taxonomy.md) | بعدی: [قیمت‌گذاری و هزینه‌ها](03-pricing-and-costs.md)*

</div>
