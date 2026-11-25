<div dir="rtl">

# الگوهای طراحی هوش مصنوعی (AI Design Patterns)

این فصل الگوهای رایج برای ساخت سیستم‌های هوش مصنوعی را مشابه الگوهای طراحی در مهندسی نرم‌افزار دسته‌بندی می‌کند. هر الگو شامل زمان استفاده، راهنمای پیاده‌سازی و بده‌بستان‌ها (Tradeoffs) است.

## فهرست مطالب

- [الگوهای RAG](#rag-patterns)
- [الگوهای Agent](#agent-patterns)
- [الگوهای بهینه‌سازی](#optimization-patterns)
- [الگوهای قابلیت اطمینان](#reliability-patterns)
- [الگوهای هزینه](#cost-patterns)
- [پرسش‌های مصاحبه](#interview-questions)
- [منابع و مراجع](#references)

---

## الگوهای RAG <a id="rag-patterns"></a>

### الگو: Naive RAG

ساده‌ترین پیاده‌سازی RAG:

<div dir="ltr">

```
Query → Embed → Search → Top K → Stuff into prompt → Generate
```

</div>

**زمان استفاده:**
- ساخت MVP و نمونه‌سازی اولیه
- پرسش‌وپاسخ ساده
- زمانی که کیفیت بازیابی به اندازه کافی خوب باشد

**محدودیت‌ها:**
- نبود رتبه‌بندی مجدد (Reranking)
- نبود بهبود پرس‌وجو (Query enhancement)
- احتمال بازیابی Chunkهای نامرتبط

---

### الگو: Advanced RAG

خط لوله ارتقایافته با چندین مرحله:

<div dir="ltr">

```
Query → Rewrite → Embed → Hybrid Search → Rerank → Filter → Generate
```

</div>

<div dir="ltr">

```python
class AdvancedRAG:
    async def query(self, user_query: str) -> str:
        # Step 1: Query rewriting
        enhanced_query = await self.rewrite_query(user_query)
        
        # Step 2: Hybrid retrieval
        semantic_results = await self.vector_search(enhanced_query, top_k=50)
        keyword_results = await self.bm25_search(enhanced_query, top_k=50)
        
        # Step 3: Fusion
        combined = self.reciprocal_rank_fusion(semantic_results, keyword_results)
        
        # Step 4: Reranking
        reranked = await self.rerank(enhanced_query, combined[:20])
        
        # Step 5: Generation with top results
        context = self.format_context(reranked[:5])
        return await self.generate(user_query, context)
```

</div>

**زمان استفاده:**
- سیستم‌های محیط عملیاتی (Production)
- زمانی که دقت اهمیت دارد
- مجموعه‌اسناد پیچیده

---

### الگو: بازیابی والد-فرزند (Parent-Child Retrieval)

بازیابی Chunkهای کوچک و بازگرداندن Chunkهای بزرگ‌تر والد:

<div dir="ltr">

```
Document
    └── Parent chunk (2000 tokens)
            ├── Child chunk (200 tokens) ← Retrieve on this
            ├── Child chunk (200 tokens)
            └── Child chunk (200 tokens)
```

</div>

<div dir="ltr">

```python
class ParentChildRetriever:
    def __init__(self, vector_store):
        self.vector_store = vector_store
    
    async def retrieve(self, query: str, top_k: int = 5) -> list[str]:
        # Search on child chunks (more precise)
        child_results = await self.vector_store.search(
            query, 
            collection="child_chunks",
            top_k=top_k * 3
        )
        
        # Get unique parent chunks
        parent_ids = set(r.metadata["parent_id"] for r in child_results)
        
        # Return parent chunks (more context)
        parents = await self.get_parents(list(parent_ids)[:top_k])
        return parents
```

</div>

**زمان استفاده:**
- نیاز به دقت بالا در بازیابی
- نیاز به کانتکست غنی در تولید پاسخ
- ساختار سلسله‌مراتبی اسناد

---

### الگو: Self-RAG

مدل تصمیم می‌گیرد چه زمانی و چه چیزی را بازیابی کند:

<div dir="ltr">

```python
class SelfRAG:
    async def generate(self, query: str) -> str:
        # Step 1: Decide if retrieval is needed
        needs_retrieval = await self.assess_retrieval_need(query)
        
        if needs_retrieval:
            # Step 2: Retrieve
            context = await self.retrieve(query)
            
            # Step 3: Assess relevance
            relevant_context = await self.filter_relevant(query, context)
            
            # Step 4: Generate with context
            response = await self.generate_with_context(query, relevant_context)
            
            # Step 5: Self-critique
            is_supported = await self.check_support(response, relevant_context)
            if not is_supported:
                response = await self.regenerate(query, relevant_context)
        else:
            response = await self.generate_without_context(query)
        
        return response
```

</div>

**زمان استفاده:**
- دانش ترکیبی (دانش پارامتریک + دانش بازیابی‌شده)
- تمایل به گزینشی عمل کردن مدل
- پژوهش و آزمایش

---

### الگو: RAG اصلاحی (Corrective RAG یا CRAG)

ارزیابی و اصلاح کیفیت بازیابی:

<div dir="ltr">

```python
class CorrectiveRAG:
    async def query(self, user_query: str) -> str:
        # Initial retrieval
        docs = await self.retrieve(user_query)
        
        # Grade each document
        graded = []
        for doc in docs:
            grade = await self.grade_relevance(user_query, doc)
            graded.append((doc, grade))
        
        # Categorize results
        relevant = [d for d, g in graded if g == "relevant"]
        ambiguous = [d for d, g in graded if g == "ambiguous"]
        
        if len(relevant) >= 3:
            # Enough relevant docs
            context = relevant
        elif len(relevant) + len(ambiguous) >= 2:
            # Refine ambiguous docs
            refined = await self.refine_search(user_query, ambiguous)
            context = relevant + refined
        else:
            # Web search fallback
            web_results = await self.web_search(user_query)
            context = relevant + web_results
        
        return await self.generate(user_query, context)
```

</div>

**زمان استفاده:**
- پیکره اسناد نامطمئن
- نیاز به دقت بالا
- امکان پذیرش تاخیر (Latency) بیشتر برای بررسی‌های کیفیت

---

## الگوهای Agent <a id="agent-patterns"></a>

### الگو: ReAct

درهم‌آمیزی استدلال (Reasoning) و اقدام (Acting):

<div dir="ltr">

```
Thought → Action → Observation → Thought → Action → Observation → Answer
```

</div>

برای پیاده‌سازی به [معماری‌های Agent](../07-agentic-systems/01-agent-fundamentals.md) مراجعه کنید.

**زمان استفاده:**
- سیستم‌های Agent همه‌منظوره
- تصمیم‌گیری قابل توضیح (Explainable)
- وظایف با پیچیدگی متوسط

---

### الگو: برنامه‌ریزی و اجرا (Plan-and-Execute)

ابتدا یک برنامه ایجاد کنید، سپس گام‌ها را اجرا نمایید:

<div dir="ltr">

```python
class PlanAndExecuteAgent:
    async def run(self, task: str) -> str:
        # Step 1: Create plan
        plan = await self.create_plan(task)
        
        # Step 2: Execute each step
        results = []
        for step in plan.steps:
            result = await self.execute_step(step, results)
            results.append(result)
            
            # Re-plan if needed
            if result.needs_replanning:
                plan = await self.replan(task, results)
        
        # Step 3: Synthesize final answer
        return await self.synthesize(task, results)
    
    async def create_plan(self, task: str) -> Plan:
        prompt = f"""
        Create a step-by-step plan to accomplish this task: {task}
        
        Return as JSON:
        {{
            "steps": [
                {{"id": 1, "description": "...", "tool": "..."}},
                ...
            ]
        }}
        """
        return await self.llm.generate(prompt)
```

</div>

**زمان استفاده:**
- وظایف پیچیده چندمرحله‌ای
- نیاز به دید و شفافیت روی برنامه اجرا
- وظایفی که از تجزیه (Decomposition) سود می‌برند

---

### الگو: منتقد/تاییدکننده (Critic/Verifier)

یک Agent تولید می‌کند و Agent دیگری نقد و بررسی می‌نماید:

<div dir="ltr">

```python
class CriticPattern:
    async def generate_with_critique(self, task: str, max_iterations: int = 3) -> str:
        response = await self.generator.generate(task)
        
        for i in range(max_iterations):
            # Critique the response
            critique = await self.critic.evaluate(task, response)
            
            if critique.is_acceptable:
                break
            
            # Regenerate with feedback
            response = await self.generator.regenerate(
                task, 
                previous=response, 
                feedback=critique.feedback
            )
        
        return response
```

</div>

**زمان استفاده:**
- زمانی که کیفیت حیاتی است
- امکان پذیرش تاخیر اضافی وجود دارد
- وظایف دارای معیارهای موفقیت شفاف هستند

---

### الگو: Agentهای سلسله‌مراتبی (Hierarchical Agents)

مدیر (Manager) وظایف را به کارگزاران متخصص محول می‌کند:

<div dir="ltr">

```python
class ManagerAgent:
    def __init__(self):
        self.workers = {
            "research": ResearchAgent(),
            "coding": CodingAgent(),
            "writing": WritingAgent()
        }
    
    async def run(self, task: str) -> str:
        # Decompose task
        subtasks = await self.decompose(task)
        
        # Assign to workers
        results = {}
        for subtask in subtasks:
            worker = self.workers[subtask.worker_type]
            results[subtask.id] = await worker.execute(subtask)
        
        # Synthesize results
        return await self.synthesize(task, results)
```

</div>

**زمان استفاده:**
- وظایف پیچیده در حوزه‌های مختلف
- ابزارهای متفاوت برای هر زیرتسک
- فرصت‌های موازی‌سازی (Parallelization)

---

## الگوهای بهینه‌سازی <a id="optimization-patterns"></a>

### الگو: آبشار مدل‌ها (Cascading Models)

مسیریابی به ارزان‌ترین مدل کافی:

<div dir="ltr">

```python
class ModelCascade:
    def __init__(self):
        # (model, input USD per 1M tokens at list price, October 2026)
        self.models = [
            ("gpt-6-luna", 0.10),         # Cheapest
            ("claude-sonnet-5-5", 2.00),  # Mid-tier
            ("claude-opus-5-5", 4.00)     # Most capable
        ]
    
    async def generate(self, query: str) -> str:
        # Classify complexity
        complexity = await self.classify_complexity(query)
        
        if complexity == "simple":
            return await self.call_model("gpt-6-luna", query)
        elif complexity == "medium":
            return await self.call_model("claude-sonnet-5-5", query)
        else:
            return await self.call_model("claude-opus-5-5", query)
```

</div>

**زمان استفاده:**
- حجم بالای پرس‌وجو
- پیچیدگی متغیر پرس‌وجوها
- اولویت با بهینه‌سازی هزینه

**مسیریابی در برابر آبشار (Routing versus cascading).** کد بالا از همان ابتدا بر اساس یک دسته‌بندی‌کننده (Classifier) مسیریابی می‌کند. یک آبشار واقعی ابتدا مدل ارزان را اجرا می‌کند و تنها زمانی که یک تاییدکننده (Verifier) یا بررسی اطمینان شکست بخورد به مدل بالاتر ارجاع می‌دهد؛ این روش زمانی سودآور است که بیشتر درخواست‌ها ساده و شکست‌ها قابل تشخیص باشند. دو پیچیدگی رایج در سال ۲۰۲۶: اول، سطح تلاش استدلال (Reasoning effort) را در هر لایه پین کنید، زیرا مقادیر پیش‌فرض بین نسخه‌ها تغییر می‌کنند (مدل Claude Opus 5.5 به‌طور پیش‌فرض روی `medium` است، در حالی که Opus 5 روی `high` بود)؛ دوم، با هر تغییر قیمت، لایه‌ها را دوباره بازآرایی کنید، زیرا قیمت دیگر شاخص توانمندی نیست. در شاخص هوش Artificial Analysis نسخه v5.0.1 (۳ نوامبر ۲۰۲۶)، مدل Opus 5.5 با قیمت ۴/۲۰ دلار به ازای هر ۱ میلیون توکن امتیاز ۵۹ (حداکثر تلاش) می‌گیرد که بالاتر از GPT-6 Astra با قیمت ۱۰/۵۰ دلار و امتیاز ۵۷ (حداکثر) است؛ و در نسخه v5.0 مدل GPT-6.1 Terra با قیمت ۱/۵ دلار در حداکثر تلاش امتیاز ۵۱ گرفت (۳۸ در حالت پیش‌فرض `medium`) که بالاتر از Gemini 4 Argon با امتیاز ۵۰ (تلاش high) و قیمت رسمی ۴/۲۰ دلار از ۱ دسامبر ۲۰۲۶ بود. همچنین بر اساس طول Prompt نیز مسیریابی کنید: مدل Claude Haiku 5.5 به محض عبور Prompt از ۱۰۰ هزار Token کل درخواست را با ضریب ۵ برابر محاسبه می‌کند، بنابراین یک لایه ارزان می‌تواند در ورودی‌های طولانی به گران‌ترین گزینه تبدیل شود.

---

### الگو: اجرای گمانه‌زنانه (Speculative Execution)

پیش‌نویس با مدل کوچک، راستی‌آزمایی با مدل بزرگ:

<div dir="ltr">

```python
class SpeculativeExecution:
    async def generate(self, prompt: str, n_tokens: int = 5, max_tokens: int = 512) -> str:
        output = []
        
        while len(output) < max_tokens:
            # Draft with small model
            draft = await self.draft_model.generate(
                prompt + "".join(output),
                n_tokens=n_tokens
            )
            
            # Verify with large model
            verified = await self.target_model.verify(
                prompt + "".join(output),
                draft
            )
            
            # Accept verified tokens
            output.extend(verified.accepted_tokens)
            
            if verified.is_complete:
                break
        
        return "".join(output)
```

</div>

**زمان استفاده:**
- برنامه‌های حساس به تاخیر (Latency-critical)
- وجود مدل پیش‌نویس هم‌راستا (Aligned draft model)
- الگوهای تولید قابل پیش‌بینی

در محیط عملیاتی به‌ندرت این حلقه را خودتان می‌نویسید؛ موتور سروینگ آن را اجرا می‌کند. موتورهای vLLM و SGLang دارای سرهای EAGLE-3 و پیش‌بینی چندتوکنی بومی (MTP) به همراه پیش‌نویس‌کننده‌های انتشار بلوکی DFlash هستند (شرکت Inco AI افزایش توان عملیاتی ۲.۷ تا ۳.۴ برابری را برای DFlash 2 روی Qwen3.8-27B گزارش کرده است)، و vLLM همچنین ماژول‌های DSpark شرکت DeepSeek را که درون چک‌پوینت مدل بسته‌بندی شده‌اند اجرا می‌کند. با بزرگ‌تر شدن اندازه دسته (Batch size)، شتاب کاهش می‌یابد، پس سرعت را در همزمانی محیط عملیاتی بسنجید؛ vLLM اعلام کرده راستی‌آزمایی تطبیقی آن گمانه‌زنی را تا همزمانی ۲۵۶ مفید نگه می‌دارد. در یک API میزبانی‌شده، اهرم معادل عبارت است از یک سطح سرعت پولی: سطح Fast شرکت OpenAI با ۲ برابر نرخ استاندارد و سطح Ultrafast با ۶ برابر (روی GPT-6 Astra، و از ۸ اکتبر ۲۰۲۶ روی GPT-6.1 Sol)، یا حالت سریع Anthropic برای Opus 5.5 با ۲ برابر نرخ (۸/۴۰ دلار، خارج‌شده از پیش‌نمایش پژوهشی از ۱۵ اکتبر ۲۰۲۶؛ در Claude API، مدل‌های Claude در Google Cloud با مدیریت Anthropic، و استقرارهای میزبانی‌شده در Foundry آژور). بخش [رمزگشایی گمانه‌زنانه](../04-inference-optimization/03-speculative-decoding.md) را ببینید.

---

### الگو: لایه‌های کشینگ (Caching Layers)

استراتژی کشینگ چندسطحی:

<div dir="ltr">

```python
class CachingLLM:
    def __init__(self):
        self.exact_cache = ExactMatchCache()
        self.semantic_cache = SemanticCache(threshold=0.95)
    
    async def generate(self, query: str) -> str:
        # Level 1: Exact match
        cached = await self.exact_cache.get(query)
        if cached:
            return cached
        
        # Level 2: Semantic similarity
        similar = await self.semantic_cache.get_similar(query)
        if similar:
            return similar
        
        # Cache miss: Generate
        response = await self.llm.generate(query)
        
        # Store in caches
        await self.exact_cache.set(query, response)
        await self.semantic_cache.set(query, response)
        
        return response
```

</div>

**زمان استفاده:**
- پرس‌وجوهای مشابه و تکراری
- اولویت با کاهش هزینه
- تحمل‌پذیری نسبت به اندکی کهنگی داده‌ها (Staleness)

**کش Prompt ارائه‌دهنده را زیر هر دو لایه قرار دهید.** کش‌های تطابق دقیق و معنایی تنها زمانی کمک می‌کنند که کل پرسش‌ها تکرار شوند. کشینگ Prompt (یا پیشوند / Prefix caching) به هر درخواستی که پیشوند ثابتی را به اشتراک بگذارد کمک می‌کند، که در یک حلقه Agent تقریباً در تمام فراخوانی‌ها رخ می‌دهد: شرکت Anthropic گزارش داده که ترافیک Claude Code به ازای هر Token خروجی، ۳۲۴ Token ورودی مصرف می‌کند. خواندن از کش در بیشتر مدل‌ها ۰.۱ برابر ورودی محاسبه می‌شود، در مدل‌های Claude Opus 5.5، Claude Sonnet 5.5، GPT-6.1 Sol و GPT-6.1 Terra برابر با ۰.۰۵ برابر و در Claude Fable 5.1 برابر با ۰.۰۲۵ برابر است، در مقابل هزینه اضافی نوشتن برابر با ۱.۲۵ برابر (۲ برابر برای کش ۱ ساعته Anthropic؛ مدل‌های GPT-5.6 و جدیدتر OpenAI یک کش ۳۰ دقیقه‌ای با نرخ ۱.۲۵ برابر و از ۲۰ اکتبر ۲۰۲۶ یک کش ۱۲ ساعته با نرخ ۲.۵ برابر ارائه می‌دهند). مدل Gemini 4 Argon تنها به صورت ضمنی کش می‌کند، بنابراین کد کنترل کش صریح در آنجا اثری ندارد. Prompt را طوری مرتب کنید که بخش‌های ثابت (Prompt سیستمی، تعریف ابزارها، اسناد پایدار) در ابتدا بیایند، و با نرخ اصابت کش به عنوان یک SLO برخورد کنید؛ هر دو شرکت OpenAI و Anthropic در سپتامبر ۲۰۲۶ ابزارهای عیب‌یابی عدم اصابت کش (Cache-miss diagnostics) را به صورت عمومی (GA) عرضه کردند.

---

## الگوهای قابلیت اطمینان <a id="reliability-patterns"></a>

### الگو: تلاش مجدد با بازگشت اضطراری (Retry with Fallback)

<div dir="ltr">

```python
class RetryWithFallback:
    async def generate(self, query: str) -> LLMResponse:
        providers = [
            ("openai", "gpt-6-sol"),
            ("anthropic", "claude-sonnet-5-5"),
            ("google", "gemini-3.8-flash")
        ]
        
        for provider, model in providers:
            try:
                response = await self.call(provider, model, query)
            except (RateLimitError, ServiceError, TimeoutError):
                continue
            
            # A safety refusal is an outcome, not an outage: Claude returns it
            # as HTTP 200 with stop_reason "refusal". Handle it deliberately
            # (the provider's own fallback, a user message, or a human), not by
            # shopping the request to another vendor.
            if response.stop_reason == "refusal":
                return self.handle_refusal(response)
            return response
        
        # All providers failed
        raise AllProvidersUnavailable()
```

</div>

سه نکته باعث می‌شود بازگشت اضطراری (Fallback) دشوارتر از چیزی باشد که در این حلقه به نظر می‌رسد:

- **بازگشت اضطراری باید میان ارائه‌دهندگان مختلف انجام شود.** شرکت Anthropic بین ۱۶ اوت و ۲۹ سپتامبر ۲۰۲۶ حداقل ۱۲ حادثه بزرگ یا بحرانی ثبت کرد، و یک حادثه در OpenAI در ۲۹ سپتامبر همزمان API، سرویس ChatGPT و Codex را به مدت حدود ۵ ساعت و ۲۰ دقیقه دچار اختلال نمود. بازگشت اضطراری به مدل دوم از همان ارائه‌دهنده، حوزه شکست (Failure domain) یکسانی دارد.
- **بازگشت اضطراری نوعی تغییر رفتار است.** بلوک‌های تفکر (Thinking blocks) در Claude به مدل و گفت‌وگوی تولیدکننده آن گره خورده‌اند، بنابراین انتقال در میانه گفت‌وگو باید آن‌ها را دور بریزد و تاریخچه را از پیام‌های قابل مشاهده بازسازی کند. ساختار درخواست‌ها نیز متفاوت است: مدل‌های Opus 5.5، Sonnet 5.5 و Fable/Mythos 5.1 برای `tool_choice` اجباری خطای ۴۰۰ برمی‌گردانند (Haiku 5.5 آن را می‌پذیرد اما از تفکر صرف‌نظر می‌کند)، نسخه `2026-10-21` از Claude API هرگونه مقدار `temperature` را روی تمام مدل‌ها رد می‌کند، و GPT-6 Astra مقدار سفارشی `temperature` را نمی‌پذیرد. وضعیت گفت‌وگو را در قالبی مستقل از ارائه‌دهنده نگهداری کنید و مجموعه ارزیابی خود را روی هر مدل موجود در زنجیره اجرا نمایید.
- **امتناع‌ها خطا نیستند.** مسیریابی را بر اساس `stop_reason` انجام دهید نه وضعیت HTTP، و از ۲۴ سپتامبر ۲۰۲۶ برای آن‌ها بودجه در نظر بگیرید: شرکت Anthropic هزینه امتناع‌های پیش از خروجی را در دسته‌های `bio`، `frontier_llm` و `reasoning_extraction` محاسبه و دریافت می‌کند.

---

### الگو: مدارشکن (Circuit Breaker)

<div dir="ltr">

```python
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 60):
        self.failures = 0
        self.state = "closed"
        self.last_failure = None
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
    
    async def call(self, func, *args):
        if self.state == "open":
            if time.time() - self.last_failure > self.reset_timeout:
                self.state = "half-open"
            else:
                raise CircuitOpenError()
        
        try:
            result = await func(*args)
            self.failures = 0
            self.state = "closed"
            return result
        except Exception as e:
            self.failures += 1
            self.last_failure = time.time()
            if self.failures >= self.failure_threshold:
                self.state = "open"
            raise
```

</div>

---

### الگو: دیواره آتشین ایزوله‌سازی (Bulkhead)

جداسازی شکست‌ها میان مولفه‌ها:

<div dir="ltr">

```python
class BulkheadExecutor:
    def __init__(self, max_concurrent: int = 10):
        self.semaphore = asyncio.Semaphore(max_concurrent)
    
    async def execute(self, func, *args):
        async with self.semaphore:
            return await func(*args)

# Separate bulkheads for different operations
rag_bulkhead = BulkheadExecutor(max_concurrent=20)
agent_bulkhead = BulkheadExecutor(max_concurrent=5)
```

</div>

---

## الگوهای هزینه <a id="cost-patterns"></a>

### الگو: بودجه توکن (Token Budget)

<div dir="ltr">

```python
class TokenBudget:
    def __init__(self, max_input: int, max_output: int):
        self.max_input = max_input
        self.max_output = max_output
    
    def constrain_input(self, messages: list[dict]) -> list[dict]:
        total_tokens = 0
        constrained = []
        
        for msg in reversed(messages):
            tokens = count_tokens(msg["content"])
            if total_tokens + tokens > self.max_input:
                break
            constrained.insert(0, msg)
            total_tokens += tokens
        
        return constrained
```

</div>

---

### الگو: دکوراتور ردیابی هزینه (Cost Tracking Decorator)

<div dir="ltr">

```python
def track_cost(model: str):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            response = await func(*args, **kwargs)
            
            # Read usage from the response itself; a global token counter is
            # wrong under concurrency. Field names vary by provider.
            u = response.usage
            cost = calculate_cost(
                model,
                uncached_input=u.input_tokens,
                cache_writes=u.cache_write_tokens,  # 1.25x input (2x for a 1-hour cache)
                cache_reads=u.cache_read_tokens,    # 0.025x to 0.1x input
                output=u.output_tokens,             # includes reasoning tokens
            )
            metrics.record("llm_cost", cost, tags={"model": model})
            
            return response
        return wrapper
    return decorator

@track_cost("gpt-6-sol")
async def generate_response(query: str):
    return await llm.generate(query)
```

</div>

هر کلاس Token را به صورت جداگانه قیمت‌گذاری کنید، وگرنه داشبورد شما چند برابر خطا خواهد داشت: خواندن و نوشتن کش نرخ‌های متفاوتی دارند، Tokenهای استدلال به عنوان خروجی حساب می‌شوند، OpenAI پس از عبور ورودی از ۲۷۲ هزار Token کل درخواست را با نرخ‌های کانتکست طولانی محاسبه می‌کند، و سطح سرویس (Batch، Fast) و اقامت داده کل مبلغ را ضرب می‌کنند. برای فرمول کامل به [قیمت‌گذاری و هزینه‌ها](../02-model-landscape/03-pricing-and-costs.md) مراجعه کنید.

---

## پرسش‌های مصاحبه <a id="interview-questions"></a>

### پرسش: سه الگوی RAG را توضیح دهید و بگویید هرکدام چه زمانی کاربرد دارند.

**پاسخ قوی:**

«من سه الگوی Naive RAG، Advanced RAG و Parent-Child Retrieval را توضیح می‌دهم.

**الگوی Naive RAG** ساده‌ترین حالت است: پرس‌وجو را امبد (Embed) کنید، بردارها را جست‌وجو کنید، K نتیجه برتر را در Prompt قرار دهید و تولید پاسخ انجام شود. من از این الگو برای ساخت MVP و زمانی که کیفیت بازیابی از قبل خوب است استفاده می‌کنم. پیاده‌سازی آن سریع است اما رتبه‌بندی مجدد (Reranking) یا بهبود پرس‌وجو ندارد.

**الگوی Advanced RAG** چندین مرحله اضافه می‌کند: بازنویسی پرس‌وجو، جست‌وجوی ترکیبی (معنایی + کلیدواژه‌ای)، رتبه‌بندی مجدد و فیلتر کردن. من در محیط عملیاتی زمانی که دقت اهمیت دارد از آن استفاده می‌کنم. تاخیر اضافی (۱۰۰ تا ۲۰۰ میلی‌ثانیه برای Reranking) به ازای ۱۰ تا ۱۵ درصد بهبود دقت کاملاً ارزشش را دارد.

**الگوی Parent-Child Retrieval** قطعه‌های کوچک را برای تطبیق دقیق امبد می‌کند اما Chunkهای بزرگ‌تر والد را برای کانتکست بازمی‌گرداند. من زمانی از آن استفاده می‌کنم که اسناد دارای ساختار سلسله‌مراتبی باشند و هم به دقت در بازیابی و هم به کانتکست کافی برای تولید نیاز داشته باشم.

الگویی که انتخاب می‌کنم به الزامات دقت، بودجه تاخیر (Latency budget) و ویژگی‌های اسناد بستگی دارد. اغلب با Naive RAG شروع می‌کنم تا یک خط مبنا بسازم و سپس به سمت Advanced RAG تکامل می‌دهم.»

### پرسش: برای یک سیستم LLM در محیط عملیاتی از چه الگوهای قابلیت اطمینانی استفاده می‌کنید؟

**پاسخ قوی:**

«من چندین لایه قابلیت اطمینان پیاده‌سازی می‌کنم:

**تلاش مجدد با عقب‌نشینی نمایی (Retry with exponential backoff)** برای خطاهای گذرا. محدودیت‌های نرخ (Rate limits) و خطاهای موقت در APIهای LLM رایج هستند.

**بازگشت اضطراری چندارائه‌دهنده‌ای (Multi-provider fallback)** تا اگر OpenAI دچار مشکل شد، به صورت خودکار به Anthropic یا Google مسیریابی کنم. این کار نیازمند انتزاعی‌سازی رابط LLM، نگهداری وضعیت گفت‌وگو در قالبی مستقل از ارائه‌دهنده (بلوک‌های تفکر Claude قابل پخش مجدد در مدل دیگری نیستند)، و اجرای مجموعه ارزیابی روی تمام مدل‌های زنجیره است تا انتقال خطا باعث افت بی‌سروصدای کیفیت نشود. با امتناع‌های ایمنی به صورت جداگانه برخورد می‌کنم: آن‌ها به عنوان پاسخ‌های موفق با دلیل توقف `refusal` برمی‌گردند، بنابراین بر اساس دلیل توقف مسیریابی می‌کنم نه کد وضعیت HTTP.

**مدارشکن (Circuit breaker)** برای متوقف کردن ارسال پیاپی درخواست به یک سرویس معیوب. پس از N خطا، مدار را باز می‌کنم و فوراً به مسیر جایگزین می‌فرستم تا سیستم اصلی فرصت بازیابی پیدا کند.

**تنزل تدریجی کارایی (Graceful degradation)** زمانی که همه ارائه‌دهندگان با شکست مواجه می‌شوند. به جای نمایش خطا، پاسخ‌های کش‌شده برگردانید، پیام‌های جایگزین نشان دهید، یا برای پردازش بعدی در صف قرار دهید.

**ایزوله‌سازی دیواره آتشین (Bulkhead isolation)** برای جلوگیری از آبشاری شدن خطاهای یک مولفه به کل سیستم. بارهای کاری Agent استخرهای پردازشی جداگانه‌ای از بارهای کاری RAG دریافت می‌کنند.

**مهلت‌های زمانی (Timeouts)** در هر سطح. فراخوانی‌های LLM ممکن است معلق بمانند؛ من مهلت‌های زمانی سخت‌گیرانه‌ای تنظیم و آن‌ها را با ظرافت مدیریت می‌کنم.

نکته کلیدی این است که فرض کنیم شکست حتماً رخ می‌دهد و سیستم را برای مواجهه با آن طراحی کنیم، نه اینکه صرفاً امیدوار باشیم اتفاق نیفتد.»

---

## منابع و مراجع <a id="references"></a>

- مقاله Gao و همکاران: «Retrieval-Augmented Generation for Large Language Models: A Survey» (۲۰۲۴)
- مقاله Yao و همکاران: «ReAct: Synergizing Reasoning and Acting in Language Models» (۲۰۲۳)
- مستندات الگوهای مایکروسافت برای هوش مصنوعی: https://learn.microsoft.com/azure/architecture/patterns/

---

*مبحث بعدی: [ضدالگوهایی که باید از آن‌ها پرهیز کرد (Anti-Patterns to Avoid)](02-anti-patterns.md)*

</div>
