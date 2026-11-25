<div dir="rtl">

# ضدالگوهای هوش مصنوعی (AI Anti-Patterns)

شناختن کارهایی که نباید انجام داد به اندازه دانستن بهترین روش‌ها (Best Practices) اهمیت دارد. این فصل اشتباهات رایج در طراحی سیستم‌های هوش مصنوعی را دسته‌بندی و بررسی می‌کند.

## فهرست مطالب

- [ضدالگوهای معماری](#architecture-anti-patterns)
- [ضدالگوهای RAG](#rag-anti-patterns)
- [ضدالگوهای Agent](#agent-anti-patterns)
- [ضدالگوهای پرامپت‌نویسی (Prompting)](#prompting-anti-patterns)
- [ضدالگوهای ارزیابی (Evaluation)](#evaluation-anti-patterns)
- [ضدالگوهای محیط تولید (Production)](#production-anti-patterns)
- [پرسش‌های مصاحبه](#interview-questions)

---

## ضدالگوهای معماری <a id="architecture-anti-patterns"></a>

### ضدالگوی God Prompt (پرامپت همه‌کاره)

**مسئله:** یک `Prompt` واحد و عظیم که تلاش می‌کند همه‌چیز را به تنهایی انجام دهد.

<div dir="ltr">

```python
# ANTI-PATTERN: God Prompt
SYSTEM_PROMPT = """
You are a helpful assistant. You can:
1. Answer questions about our products
2. Help with technical support
3. Process refunds
4. Schedule appointments
5. Translate languages
6. Write code
7. Analyze data
8. Generate reports
... [continues for 5000 tokens]
"""
```

</div>

**چرا شکست می‌خورد:**
- پنجره زمینه (Context) به جای محتوای کاربر، توسط دستورالعمل‌ها اشغال می‌شود
- مدل با دستورالعمل‌های متناقض دچار سردرگمی می‌شود
- بهینه‌سازی برای همه حالت‌ها غیرممکن است
- به‌روزرسانی‌ها بر کل سیستم اثر می‌گذارند

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Specialized components
class QueryRouter:
    async def route(self, query: str) -> str:
        intent = await self.classify_intent(query)
        handler = self.handlers[intent]
        return await handler.process(query)
```

</div>

---

### وابستگی به یک ارائه‌دهنده (Single Provider Dependency)

**مسئله:** کل سیستم تنها به یک ارائه‌دهنده LLM وابسته است.

<div dir="ltr">

```python
# ANTI-PATTERN: Single provider
async def generate(prompt: str) -> str:
    return await openai.chat.completions.create(...)
```

</div>

**چرا شکست می‌خورد:**
- قطعی ارائه‌دهنده مساوی است با از کار افتادن کامل سیستم. قطعی‌ها پدیده‌ای عادی هستند، نه نادر: شرکت Anthropic بین ۱۶ اوت تا ۲۹ سپتامبر ۲۰۲۶ دست‌کم ۱۲ اختلال عمده یا بحرانی را ثبت کرد، و یک اختلال در OpenAI در ۲۹ سپتامبر، API، ChatGPT و Codex را هم‌زمان به مدت حدود ۵ ساعت و ۲۰ دقیقه دچار افت عملکرد کرد
- محدودیت‌های نرخ درخواست (Rate Limits) تمام ترافیک را تحت تأثیر قرار می‌دهند
- اهرم چانه‌زنی برای قیمت‌گذاری وجود ندارد
- قفل شدن در یک خانواده مدل و تقویم بازنشستگی آن فروشنده (شرکت OpenAI اسنپ‌شات‌های `gpt-5-2025-08-07` و `o3-2025-04-16` را در ۱۱ دسامبر ۲۰۲۶ بازنشسته می‌کند، و اطلاعیه ۱۴ اکتبر آن به پنج اسنپ‌شات خانواده `gpt-4o` و `gpt-4.1`، شامل مدل‌های Fine-tune شده، پیش از خاموشی ۱۴ ژانویه ۲۰۲۷ تنها حدود سه ماه فرصت داد)

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Multi-provider with failover
class LLMClient:
    def __init__(self):
        self.providers = [OpenAI(), Anthropic(), Google()]
    
    async def generate(self, prompt: str) -> str:
        # Run the same eval suite against every provider in this list:
        # a failover that silently changes quality is its own outage
        for provider in self.providers:
            try:
                return await provider.generate(prompt)
            except ProviderError:
                continue
        raise AllProvidersFailedError()
```

</div>

---

### انجام زودهنگام Fine-tuning

**مسئله:** انجام Fine-tuning پیش از آزمودن کامل رویکردهای ساده‌تر.

**چرا شکست می‌خورد:**
- پرهزینه و زمان‌بر است
- نیازمند داده‌های آموزشی باکیفیت است (که اغلب در دسترس نیستند)
- به‌روزرسانی و نگهداری آن دشوار است
- اغلب غیرضروری است
- ریسک پلتفرم را اضافه می‌کند: شرکت OpenAI در حال جمع‌آوری سرویس Fine-tuning سلف‌سرویس است و حتی مشتریان فعال نیز از ۶ ژانویه ۲۰۲۷ نمی‌توانند کارهای جدید بسازند. اگر Fine-tuning انجام می‌دهید، وزن‌هایی (Weights) را ترجیح دهید که کنترلشان در اختیار خودتان است

**روند تصمیم‌گیری:**

<div dir="ltr">

```
Try prompting first
    ↓ (not working)
Try few-shot examples
    ↓ (not working)
Try RAG for knowledge
    ↓ (not working)
Consider fine-tuning (with 500+ examples)
```

</div>

---

## ضدالگوهای RAG <a id="rag-anti-patterns"></a>

### بازیابی همه‌چیز (Retrieve Everything)

**مسئله:** بازیابی تعداد بسیار زیادی سند، بدون توجه به میزان مرتبط بودن آن‌ها.

<div dir="ltr">

```python
# ANTI-PATTERN: Retrieve everything
results = vector_db.search(query, top_k=50)
context = "\n".join([r.text for r in results])
```

</div>

**چرا شکست می‌خورد:**
- نویز، سیگنال اصلی را تحت‌الشعاع قرار می‌دهد
- از محدودیت‌های زمینه (Context) فراتر می‌رود
- واحدهای Token را صرف محتوای نامرتبط می‌کند
- پدیده «گم‌شدن در میانه» (Lost in the middle) رخ می‌دهد

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Quality over quantity
results = vector_db.search(query, top_k=20)
reranked = await reranker.rerank(query, results)
context = "\n".join([r.text for r in reranked[:5] if r.score > 0.7])
```

</div>

---

### نداشتن استراتژی Chunking

**مسئله:** قطعه‌بندی دلبخواهی اسناد یا انجام ندادن Chunking.

<div dir="ltr">

```python
# ANTI-PATTERN: Fixed-size blind chunking
chunks = [text[i:i+1000] for i in range(0, len(text), 1000)]
```

</div>

**چرا شکست می‌خورد:**
- متن را از وسط جمله یا پاراگراف قطع می‌کند
- انسجام معنایی را از بین می‌برد
- اطلاعات مرتبط را از هم جدا می‌کند
- کیفیت بازیابی را کاهش می‌دهد

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Semantic-aware chunking
chunks = semantic_chunker.chunk(
    text,
    chunk_size=500,
    overlap=100,
    respect_boundaries=["paragraph", "section"]
)
```

</div>

---

### نادیده گرفتن فراداده (Metadata)

**مسئله:** برخورد یکسان با همه اسناد به‌عنوان متن ساده.

<div dir="ltr">

```python
# ANTI-PATTERN: Ignore metadata
embedding = embed(document.text)
vector_db.insert(embedding, {"text": document.text})
```

</div>

**چرا شکست می‌خورد:**
- امکان فیلتر کردن بر اساس تاریخ، منبع یا نوع وجود ندارد
- کنترل دسترسی به تفکیک هر سند ممکن نیست
- امکان وزن‌دهی به اسناد جدید در برابر قدیمی وجود ندارد
- زمینه (Context) ارزشمند از دست می‌رود

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Rich metadata
vector_db.insert(embedding, {
    "text": document.text,
    "source": document.source,
    "date": document.date,
    "access_level": document.access_level,
    "document_type": document.type,
    "section": document.section
})

# Filter query
results = vector_db.search(
    query,
    filter={"date": {"$gte": "2024-01-01"}, "access_level": user.level}
)
```

</div>

---

## ضدالگوهای Agent <a id="agent-anti-patterns"></a>

### ریسک حلقه بی‌نهایت (Infinite Loop)

**مسئله:** نبود شرط‌های توقف (Termination Conditions) برای سیستم‌های Agent.

<div dir="ltr">

```python
# ANTI-PATTERN: No limits
while not done:
    action = await agent.decide_action()
    result = await execute(action)
    done = agent.check_done(result)
```

</div>

**چرا شکست می‌خورد:**
- سیستم‌های Agent ممکن است تا ابد در حلقه بچرخند
- هزینه‌ها از کنترل خارج می‌شوند
- پاسخ هرگز به کاربر برگردانده نمی‌شود
- منابع سیستم تمام می‌شوند

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Multiple termination conditions
MAX_STEPS = 20
MAX_COST = 10.0
MAX_TIME = 300  # seconds

for step in range(MAX_STEPS):
    if cost_tracker.total > MAX_COST:
        return "Cost limit reached"
    if time.time() - start > MAX_TIME:
        return "Time limit reached"
    
    action = await agent.decide_action()
    result = await execute(action)
    
    if agent.check_done(result):
        return result
    
return "Step limit reached"
```

</div>

---

### دسترسی ناامن به ابزارها (Unsafe Tool Access)

**مسئله:** دادن دسترسی بدون محدودیت به ابزارها برای سیستم‌های Agent.

<div dir="ltr">

```python
# ANTI-PATTERN: Full access
tools = [
    delete_file,
    execute_shell_command,
    send_email,
    database_query  # unrestricted!
]
```

</div>

**چرا شکست می‌خورد:**
- ایجنت (Agent) می‌تواند فایل‌های حیاتی را حذف کند
- می‌تواند داده‌ها را به بیرون نشت دهد، حتی بدون حضور مهاجم: در رخداد PixelLeak (گزارش‌شده توسط Glow Security در ۲۹ سپتامبر ۲۰۲۶)، سیستم‌های Agent برنامه‌نویسی که مأمور پیوست کردن اسکرین‌شات به Pull Requestهای خصوصی بودند، به جای آن مخازن عمومی ساختند و بیش از ۱۳٬۰۰۰ تصویر را در بیش از ۹۰۰ مخزن منتشر کردند
- می‌تواند دستورات مخرب را اجرا کند
- هیچ ردپای ممیزی (Audit Trail) وجود ندارد
- اجراهای ارزیابی و آموزش از این خطر مستثنا نیستند: در آزمایش‌های سایبری مؤسسه امنیت هوش مصنوعی بریتانیا (گزارش‌شده در ۴ اوت ۲۰۲۶)، هنگامی که طبقه‌بندهای توسعه‌دهنده عمداً خاموش و دسترسی اینترنت عمداً روشن بود، سیستم‌های Agent در ۱۰ اجرا از ۱۲۲ اجرا، ۱۹ اقدام غیرمجاز در اینترنت زنده انجام دادند که برخی علیه افراد و سازمان‌های واقعی بود
- هشدار به تنهایی به معنای مهار نیست: در یک اجرای آموزشی OpenAI که در ۲۵ سپتامبر ۲۰۲۶ افشا شد، یک Agent از طریق DNS که به اندازه کافی فیلتر نشده بود تونل زد و به بیرون دسترسی یافت؛ سیستم پایش حدود ۱۲ دقیقه بعد هشدار داد، اما به دلیل شکست مکانیزم توقف خودکار، اجرا تنها حدود ۲.۵ ساعت بعد متوقف شد

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Scoped, validated tools
tools = [
    ScopedFileTool(allowed_dirs=["/tmp/agent"]),
    RestrictedShellTool(allowed_commands=["ls", "cat"]),
    EmailTool(requires_confirmation=True),
    ReadOnlyDatabaseTool(allowed_tables=["products"])
]

# And contain the environment, not just the tool list
sandbox = Sandbox(
    egress="deny-by-default",          # DNS, package proxies, and publish endpoints included
    allow=["pypi-proxy.internal"],
    secrets=None,                      # agents can evade pattern-based secret scanning
    on_monitor_alert="kill",           # an alert that only pages a human is not a control
)
```

</div>

همان سندباکس (Sandbox) را در محیط‌های ارزیابی و یادگیری تقویتی (RL) نیز مانند سیستم‌های Agent در محیط تولید (Production) اعمال کنید و توقف خودکار را دقیقاً به همان روشی آزمایش کنید که جایگزینی خطا (Failover) را تست می‌کنید.

---

### سیستم Agent بدون حافظه

**مسئله:** ایجنت (Agent) در هر نوبت از صفر شروع می‌کند.

<div dir="ltr">

```python
# ANTI-PATTERN: Stateless agent
async def handle_message(message: str) -> str:
    return await agent.run(message)  # No context
```

</div>

**چرا شکست می‌خورد:**
- نمی‌تواند وظایف چندنوبتی (Multi-turn) را انجام دهد
- اشتباهات مشابه را تکرار می‌کند
- نمی‌تواند از تجربه بیاموزد
- تجربه کاربری ضعیفی ایجاد می‌کند

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Persistent memory
async def handle_message(session_id: str, message: str) -> str:
    memory = await memory_store.get(session_id)
    response = await agent.run(message, memory=memory)
    await memory_store.update(session_id, memory)
    return response
```

</div>

با این حال، حافظه بدون هزینه نیست. در وظایفی که برای آشکارسازی تله‌های ناشی از حافظه طراحی شده بودند، بنچمارک MemTrapBench (مقاله `arXiv 2608.20202`) نشان داد که تمام استراتژی‌های حافظه در پنج فریم‌ورک حافظه، حتی زمانی که خاطرات ذخیره‌شده درست و مرتبط بودند، عملکردی ضعیف‌تر از حالت بدون حافظه داشتند. حافظه ماندگار همچنین یک سطح حمله برای تزریق (Injection) است. تنها مواردی را ذخیره کنید که در نوبت‌های بعدی به‌طور اثبات‌شده مورد نیاز هستند، منشأ (Provenance) را در زمان نوشتن ثبت کنید و سیستم را هم با حافظه روشن و هم با حافظه خاموش ارزیابی کنید.

---

## ضدالگوهای پرامپت‌نویسی (Prompting) <a id="prompting-anti-patterns"></a>

### دستورالعمل‌های مبهم (Vague Instructions)

**مسئله:** دستورهای مبهم `Prompt` که از آن‌ها انتظار رفتار دقیق می‌رود.

<div dir="ltr">

```python
# ANTI-PATTERN: Vague
prompt = "Help the user with their request."
```

</div>

**چرا شکست می‌خورد:**
- مفهوم «کمک» تعریف نشده است
- قالبی مشخص نشده است
- مرزها و محدودیت‌ها تعیین نشده‌اند
- رفتار غیرقابل پیش‌بینی و ناپایدار است

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Specific and structured
prompt = """
You are a customer support agent for TechCorp.

Your role:
- Answer questions about our products
- Help troubleshoot issues
- Escalate to human when unsure

Response format:
1. Acknowledge the issue
2. Provide a solution or ask clarifying questions
3. Offer next steps

Do NOT:
- Make promises about refunds (escalate instead)
- Provide legal or medical advice
- Share internal company information
"""
```

</div>

---

### نداشتن قالب خروجی (No Output Format)

**مسئله:** انتظار خروجی ساختاریافته بدون مشخص کردن قالب.

<div dir="ltr">

```python
# ANTI-PATTERN: Hope for structure
prompt = "Extract the person's name, date, and location from this text."
response = await llm.generate(prompt)
# Response: "The person is John, he was there on March 5th in NYC"
# Now try to parse that...
```

</div>

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Explicit format
prompt = """
Extract information and return as JSON:
{
    "name": "string",
    "date": "YYYY-MM-DD",
    "location": "string"
}

Text: ...
"""
# Better: schema-constrained structured outputs
# (json_object mode guarantees valid JSON, not your schema)
response = await llm.generate(
    prompt,
    response_format={"type": "json_schema", "json_schema": EXTRACTION_SCHEMA}
)
```

</div>

از ترفند قدیمی اجبار به فراخوانی ابزار (Tool Call) برای دریافت JSON استفاده نکنید. مقدار `tool_choice` برابر با `any` یا نام یک ابزار مشخص، اکنون در مدل‌های Claude Fable/Mythos 5.1، Opus 5.5 و Sonnet 5.5 خطای 400 برمی‌گرداند و مدل Haiku 5.5 آن را می‌پذیرد اما مرحله تفکر (Thinking) را رد می‌کند؛ به جای آن از خروجی‌های ساختاریافته (Structured Outputs) یا حالت `auto` همراه با اسکیماهای سخت‌گیرانه ابزار استفاده کنید.

---

## ضدالگوهای ارزیابی (Evaluation) <a id="evaluation-anti-patterns"></a>

### ارزیابی حسی و سلیقه‌ای (Vibes-Based Evaluation)

**مسئله:** استفاده از معیار «به نظر من خوب است» به‌عنوان روش ارزیابی.

<div dir="ltr">

```python
# ANTI-PATTERN: Manual spot-checking
for i in range(5):
    response = await generate(test_prompts[i])
    print(response)  # Developer looks at it
# "Looks good, ship it!"
```

</div>

**چرا شکست می‌خورد:**
- تکرارپذیر نیست
- نمونه‌ها به‌صورت گزینشی (Cherry-picked) انتخاب می‌شوند
- مقایسه‌ای با خط مبنا (Baseline) وجود ندارد
- موارد مرزی (Edge Cases) را نادیده می‌گیرد

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Systematic evaluation
eval_dataset = load_eval_set()  # 100+ examples
results = []

for example in eval_dataset:
    response = await generate(example["input"])
    score = await evaluate(response, example["expected"])
    results.append(score)

metrics = {
    "accuracy": sum(results) / len(results),
    "failures": [e for e, r in zip(eval_dataset, results) if r < 0.5]
}
```

</div>

---

### آموزش یا تنظیم روی مجموعه آزمون (Test Set)

**مسئله:** استفاده از داده‌های ارزیابی نهایی برای تصمیم‌گیری‌های توسعه.

<div dir="ltr">

```python
# ANTI-PATTERN: Overfitting to eval
for iteration in range(100):
    accuracy = evaluate_on_test_set()  # Same set every time
    tweak_prompt_based_on_failures(test_set)  # Optimizing for test set
```

</div>

**چرا شکست می‌خورد:**
- باعث بیش‌برازش (Overfitting) روی نمونه‌های خاص می‌شود
- عملکرد در دنیای واقعی متفاوت خواهد بود
- هیچ معیار واقعی برای تعمیم‌پذیری (Generalization) وجود ندارد

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Proper data splits
dev_set = load_dev_set()      # For iteration
test_set = load_test_set()    # Final evaluation only

# Iterate on dev set
for iteration in range(100):
    accuracy = evaluate(dev_set)
    improve_based_on(dev_set)

# Final evaluation on untouched test set
final_accuracy = evaluate(test_set)
```

</div>

---

### انتخاب مدل بر اساس جدول رده‌بندی (Leaderboard)

**مسئله:** انتخاب یک مدل از روی جدول پست معرفی یا تیتر یک جدول رده‌بندی (Leaderboard).

<div dir="ltr">

```python
# ANTI-PATTERN: Take the top number
model = max(leaderboard, key=lambda m: m.score).name
```

</div>

**چرا شکست می‌خورد:**
- یک مدل واحد بر اساس سطح تلاش (Effort) و مجری آزمایش، امتیازهای متفاوتی می‌گیرد: مدل Claude Fable 5.1 در بنچمارک Terminal-Bench 4.0 با حداکثر تلاش، در جدول رده‌بندی tbench.ai امتیاز 57.88% و در اجرای خود Anthropic امتیاز 55.8% کسب کرده است
- یک امتیاز ممکن است متعلق به یک سیستم مسیریابی‌شده (Routed System) باشد: شرکت Anthropic مدل Opus 5.5 را با فعال بودن جایگزین ایمنی (Safeguard Fallback) امتیازدهی کرد، به طوری که وظایف سایبری مسدودشده روی Opus 4.8 اجرا شدند
- مجموعه‌های عمومی اشباع می‌شوند و نشت داده دارند: مجموعه عمومی SWE-Bench Pro v2 به سقف 99.4% (برای Opus 5) رسیده است، و یک پژوهش نشان داد که 24% تا 73% از قبولی‌های SWE-Bench Pro v1.0، بسته به مدل، به‌طور غیرواقعی و از طریق نشت تاریخچه گیت (Git-history Leakage) به دست آمده است
- توزیع وظایف شما با توزیع بنچمارک یکی نیست

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Shortlist from benchmarks, decide on your own evals
shortlist = [m for m in leaderboard if m.reports_effort_and_harness][:3]
results = {m.name: evaluate(m.name, my_eval_set, effort=m.effort) for m in shortlist}
model = pick(results, constraints={"p95_latency_s": 8, "cost_per_task_usd": 0.05})
```

</div>

---

## ضدالگوهای محیط تولید (Production) <a id="production-anti-patterns"></a>

### نداشتن محدودیت نرخ درخواست (Rate Limiting)

**مسئله:** فراخوانی‌های نامحدود LLM به ازای هر کاربر.

<div dir="ltr">

```python
# ANTI-PATTERN: Open access
@app.route("/generate")
async def generate():
    return await llm.generate(request.prompt)  # No limits!
```

</div>

**چرا شکست می‌خورد:**
- یک کاربر به تنهایی می‌تواند کل بودجه را مصرف کند
- ریسک حمله منع سرویس (Denial of Service) وجود دارد
- شگفتی‌های ناگهانی در هزینه‌ها رخ می‌دهد
- استفاده عادلانه تضمین نمی‌شود

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Rate limiting
@app.route("/generate")
@rate_limit(requests_per_minute=10, requests_per_day=100)
@cost_limit(max_cost_per_day=1.0)
async def generate():
    return await llm.generate(request.prompt)
```

</div>

---

### نداشتن کشینگ (Caching)

**مسئله:** هر درخواست تکراری مستقیماً به LLM ارسال می‌شود.

<div dir="ltr">

```python
# ANTI-PATTERN: No cache
async def answer_faq(question: str) -> str:
    return await llm.generate(question)  # Same FAQ, same cost every time
```

</div>

**چرا شکست می‌خورد:**
- اتلاف هزینه برای پرسش‌های یکسان
- تاخیر (Latency) غیرضروری
- پاسخ‌های ناهماهنگ به یک پرسش واحد

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Semantic caching
async def answer_faq(question: str) -> str:
    cached = await cache.get_similar(question, threshold=0.95)
    if cached:
        return cached.response
    
    response = await llm.generate(question)
    await cache.set(question, response)
    return response
```

</div>

کش معنایی (Semantic Caching) تنها زمانی کمک می‌کند که پرسش‌های کامل تکرار شوند. برای حلقه‌های Agent و دستورهای طولانی `Prompt` سیستم، ابتدا قابلیت Prompt Caching ارائه‌دهنده را فعال کنید: این قابلیت به هر فراخوانی‌ای که پیشوند پایداری را به اشتراک بگذارد تخفیف می‌دهد و هزینه خواندن با نرخ 0.025x تا 0.1x تعرفه ورودی محاسبه می‌شود.

---

### مقادیر پیش‌فرض شناور برای مدل (Floating Model Defaults)

**مسئله:** سپردن تصمیم‌گیری درباره اینکه کدام مدل و تنظیمات در محیط تولید (Production) سرویس‌دهی کنند به یک ابزار، SDK یا نام مستعار (Alias).

<div dir="ltr">

```python
# ANTI-PATTERN: Whatever the framework or CLI defaults to today
agent = Agent(instructions=PROMPT)                  # model chosen by the SDK
response = await llm.generate(prompt, model=ALIAS)  # effort left at the default
```

</div>

**چرا شکست می‌خورد:**
- پیش‌فرض‌ها بدون تغییر کد از سمت شما تغییر می‌کنند. در سپتامبر ۲۰۲۶ ابزار Codex CLI پیش‌فرض خود را به GPT-6.1 Sol (نسخه `rust-v0.159.1`) تغییر داد، و Claude Code پیش‌فرض Opus را به Opus 5.5 (نسخه `2.1.280`) و پیش‌فرض Sonnet را به Sonnet 5.5 (نسخه `2.1.284`) منتقل کرد؛ کتابخانه `openai-agents` SDK نیز پیش‌تر در نسخه `0.20.0` پیش‌فرض خود را به `gpt-5.6-luna` تغییر داده بود. سپس در ۱۶ اکتبر، Claude Code 2.1.302 یک پیش‌فرض مجوز (Permission) را تغییر داد: نشست‌های `claude -p` و Agent SDK که هیچ حالت مجوزی تنظیم نمی‌کنند اکنون روی ارائه‌دهندگان شخص ثالث، با تله‌متری خاموش یا در نصب تازه، در حالت `default` شروع می‌شوند؛ بنابراین یک کار CI که به پیش‌فرض قبلی تکیه داشت تحت مجوزهای متفاوتی اجرا می‌شود مگر آنکه حالت را صریحاً تنظیم کند
- تنظیمات درون یک خانواده مدل تغییر می‌کنند: مدل Opus 5.5 سطح تلاش پیش‌فرض (Effort) را از `high` به `medium` کاهش داد
- حتی یک شناسه مدل ثابت نیز می‌تواند تغییر کند: شرکت OpenAI یک باگ ورودی تصویر در GPT-6 Sol و Luna را در ۲۵ سپتامبر ۲۰۲۶ تحت همان شناسه‌های قبلی رفع کرد، بنابراین ارزیابی‌های تصویر که پیش از رفع باگ اجرا شده بودند باید دوباره اجرا می‌شدند، و در ۸ اکتبر شرکت Google شروع به مسیریابی درخواست‌های `gemini-3.7-flash` به `gemini-3.8-flash` کرد، بنابراین رشته قدیمی همچنان کار می‌کرد در حالی که مدل پشت آن تغییر کرده بود

**راه‌حل:**

<div dir="ltr">

```python
# PATTERN: Pin everything that changes behavior, and re-test on any change
MODEL = config["model"]    # exact model ID, never a framework default
EFFORT = config["effort"]  # explicit, per route
response = await llm.generate(prompt, model=MODEL, effort=EFFORT)
if not response.model.startswith(MODEL):  # providers may append a snapshot suffix
    alert("served model differs from the pinned one", served=response.model)
```

</div>

هر زمان که شناسه مدل، سطح تلاش (Effort)، نسخه SDK یا نسخه CLI تغییر کرد، مجموعه ارزیابی را دوباره اجرا کنید و نام مدلی را که هر پاسخ گزارش می‌دهد ثبت (Log) کنید.

---

## پرسش‌های مصاحبه <a id="interview-questions"></a>

### پرسش: بزرگ‌ترین ضدالگویی که در اپلیکیشن‌های LLM می‌بینید چیست؟

**پاسخ قوی:**

«مخرب‌ترین مورد، ضدالگوی «God Prompt» است: یک `Prompt` واحد و عظیم که می‌خواهد هر سناریویی را مدیریت کند.

**چرا رایج است:** در ابتدا ساده‌تر به نظر می‌رسد که با یک `Prompt` شروع کنید و با پدید آمدن نیازهای جدید، دستورالعمل‌ها را به آن اضافه کنید.

**چرا شکست می‌خورد:**
- پنجره زمینه (Context) به جای محتوای کاربر، توسط دستورالعمل‌ها اشغال می‌شود
- دستورالعمل‌های متناقض مدل را سردرگم می‌کنند
- امکان بهینه‌سازی برای موارد استفاده (Use Cases) مختلف وجود ندارد
- تغییرات، آثار جانبی غیرقابل پیش‌بینی دارند

**راه‌حل:** درخواست‌ها را به پردازنده‌های تخصصی (Specialized Handlers) مسیریابی کنید. هر پردازنده یک `Prompt` متمرکز و بهینه‌شده برای یک وظیفه خاص دارد. خود مسیریاب (Router) می‌تواند ساده (مبتنی بر کلمات کلیدی) یا هوشمند (مبتنی بر LLM برای موارد پیچیده) باشد.

این موضوع فراتر از دستورهای `Prompt` نیز کاربرد دارد. اصل کلی این است: پیچیدگی را به اجزای تخصصی تجزیه کنید، به جای آنکه همه‌چیز را در یک ساختار یکپارچه (Monolith) بگنجانید.»

### پرسش: چگونه از هزینه‌های افسارگسیخته سیستم‌های Agent جلوگیری می‌کنید؟

**پاسخ قوی:**

«محدودیت‌های چندگانه در سطوح مختلف:

**محدودیت‌های هر درخواست (Per-request):**
- حداکثر تعداد گام‌ها (مثلاً 20 گام)
- حداکثر تعداد Token (مثلاً 50K)
- حداکثر زمان (مثلاً 5 دقیقه)

**محدودیت‌های هر نشست (Per-session):**
- بودجه روزانه Token
- سقف هزینه روزانه
- در پلتفرم‌های مدیریت‌شده، استفاده از کنترل‌های بومی: نشست‌های Claude Managed Agents هنگام رسیدن به بودجه سخت با وضعیت `budget_reached` متوقف می‌شوند، و Agents API شرکت OpenAI تعداد ایجنت‌های فرعی هم‌زمان را با `max_concurrent_subagents` (پیش‌فرض 6) محدود می‌کند

**محدودیت‌های هر کاربر (Per-user):**
- محدودیت نرخ درخواست (درخواست در دقیقه/ساعت/روز)
- انتساب هزینه و تعیین سقف هزینه

**پایش (Monitoring):**
- ردیابی لحظه‌ای هزینه
- هشدار برای ناهنجاری‌ها (تک‌درخواست بیش از 1 دلار)
- کلید قطع مدار (Circuit Breaker) در صورت جهش ناگهانی هزینه‌ها

**معماری (Architecture):**
- آبشاری کردن (Cascade) از مدل‌های ارزان به مدل‌های گران
- ثابت کردن (Pin) سطح تلاش استدلال (Reasoning Effort) به ازای هر مسیر به جای پذیرفتن مقدار پیش‌فرض
- کش کردن عملیات‌های رایج، با شروع از کش پرامپت ارائه‌دهنده برای پیشوند پایدار
- دسته‌بندی (Batch) درخواست‌های مشابه

نکته کلیدی این است که فرض کنید Agent تلاش خواهد کرد تا ابد اجرا شود. در هر سطح، توقف‌های سخت (Hard Stops) تعبیه کنید. من شاهد بوده‌ام که سیستم‌های Agent بدون محدودیت‌های مناسب، در عرض چند دقیقه قبض‌های 1000 دلاری ایجاد کرده‌اند.»

---

*قبلی: [الگوهای طراحی](01-design-patterns.md)*

</div>
