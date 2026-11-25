<div dir="rtl">

# مشاهده‌پذیری مدل‌های LLM (LLM Observability)

مشاهده‌پذیری (Observability) برای سیستم‌های LLM نیازمند سازگار کردن سه رکن لاگ‌ها، متریک‌ها و ردیابی‌ها (Traces) با ویژگی‌های منحصربه‌فرد برنامه‌های هوش مصنوعی است.

## فهرست مطالب

- [چرا مشاهده‌پذیری LLM متفاوت است](#why-llm-observability-is-different)
- [سه رکن اصلی مشاهده‌پذیری](#the-three-pillars)
  - [ردیابی خطوط لوله LLM](#traces)
  - [زمانی که ابزار دقیق خاموش می‌شود](#when-instrumentation-goes-silent)
- [متریک‌های کلیدی](#key-metrics)
- [پایش کیفیت (Quality Monitoring)](#quality-monitoring)
- [ردیابی هزینه (Cost Tracking)](#cost-tracking)
- [استراتژی هشداردهی (Alerting Strategy)](#alerting-strategy)
- [ابزارهای مشاهده‌پذیری](#observability-tools)
- [پرسش‌های مصاحبه (Interview Questions)](#interview-questions)
- [منابع و مراجع (References)](#references)

---

## چرا مشاهده‌پذیری LLM متفاوت است <a id="why-llm-observability-is-different"></a>

مشاهده‌پذیری سنتی بر موارد زیر تمرکز دارد:
- الگوهای درخواست/پاسخ
- تاخیر (Latency) و توان عملیاتی (Throughput)
- نرخ خطاها
- میزان بهره‌وری منابع

سیستم‌های LLM موارد زیر را نیز اضافه می‌کنند:
- **کیفیت یک متریک درجه یک است:** یک سیستم سریع و همیشه در دسترس که خروجی‌های بد تولید کند، در عمل شکست خورده است
- **عدم قطعیت (Non-determinism):** یک ورودی یکسان می‌تواند خروجی‌های متفاوتی تولید کند
- **اقتصاد توکن (Token economics):** هزینه به شکل‌های پیچیده‌ای متناسب با میزان مصرف افزایش می‌یابد
- **خطوط لوله چندمولفه‌ای:** معماری RAG دارای مراحل بازیابی، رتبه‌بندی مجدد (Reranking) و تولید است
- **درستی ذهنی و کیفی (Subjective correctness):** اغلب هیچ حقیقت مبنایی (Ground truth) برای مقایسه مستقیم وجود ندارد

---

## سه رکن اصلی مشاهده‌پذیری <a id="the-three-pillars"></a>

### لاگ‌گیری (Logging)

<div dir="ltr">

```python
class LLMLogger:
    def log_request(
        self,
        request_id: str,
        model: str,
        messages: list[dict],
        parameters: dict
    ):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": request_id,
            "type": "llm_request",
            "model": model,
            "parameters": parameters,
            "input_tokens": self.count_tokens(messages),
            # Hash for privacy, full content in secure store
            "content_hash": self.hash_content(messages)
        }
        self.logger.info(json.dumps(log_entry))
    
    def log_response(
        self,
        request_id: str,
        response: str,
        latency_ms: float,
        tokens: dict
    ):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": request_id,
            "type": "llm_response",
            "latency_ms": latency_ms,
            "input_tokens": tokens["input"],
            "output_tokens": tokens["output"],
            "ttft_ms": tokens.get("ttft_ms"),
            "content_hash": self.hash_content(response)
        }
        self.logger.info(json.dumps(log_entry))
```

</div>

**مواردی که باید لاگ شوند:**
- شناسه درخواست (Request ID) برای همبستگی و ردیابی
- نام مدل و پارامترها، شامل سطح تلاش (Effort level) و شناسه مدلی که پاسخ واقعاً اعلام می‌کند درخواست را پردازش کرده است (تنظیمات پیش‌فرض و مسیریابی ممکن است بدون اطلاع تغییر کنند)
- تعداد Tokenها به تفکیک ورودی بدون کش، خواندن از کش، نوشتن در کش، خروجی و Tokenهای استدلال (Reasoning؛ که در صورت‌حساب به عنوان خروجی محاسبه می‌شوند اما اغلب در متن پاسخ دیده نمی‌شوند)
- تاخیر (شامل TTFT و زمان کل)
- نسخه‌های SDK و Prompt تا هرگونه افت کیفیت به تغییر مشخصی متصل شود
- محتوا (در صورت حساسیت حریم خصوصی، به صورت هش‌شده)

### متریک‌ها (Metrics)

<div dir="ltr">

```python
from prometheus_client import Counter, Histogram, Gauge

# Request metrics
llm_requests_total = Counter(
    "llm_requests_total",
    "Total LLM requests",
    ["model", "status"]
)

llm_latency_seconds = Histogram(
    "llm_latency_seconds",
    "LLM request latency",
    ["model"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

llm_ttft_seconds = Histogram(
    "llm_ttft_seconds",
    "Time to first token",
    ["model"],
    buckets=[0.05, 0.1, 0.2, 0.5, 1.0, 2.0]
)

# Token metrics
tokens_used_total = Counter(
    "tokens_used_total",
    "Total tokens consumed",
    ["model", "direction"]  # direction: uncached_input, cache_read, cache_write, output
)

# Cost metrics
llm_cost_dollars = Counter(
    "llm_cost_dollars",
    "LLM cost in dollars",
    ["model"]
)

# Quality metrics (sampled)
quality_score = Gauge(
    "llm_quality_score",
    "Sampled quality score",
    ["model", "criterion"]
)
```

</div>

### ردیابی‌ها (Traces) <a id="traces"></a>

ردیابی سرتاسری برای خطوط لوله RAG:

<div dir="ltr">

```python
from opentelemetry import trace

tracer = trace.get_tracer("rag_pipeline")

async def rag_query(query: str) -> str:
    with tracer.start_as_current_span("rag_query") as span:
        span.set_attribute("query", query)
        
        # Embedding step
        with tracer.start_as_current_span("embed_query") as embed_span:
            query_embedding = await embed(query)
            embed_span.set_attribute("embedding_dim", len(query_embedding))
        
        # Retrieval step
        with tracer.start_as_current_span("vector_search") as search_span:
            results = await vector_db.search(query_embedding, top_k=10)
            search_span.set_attribute("results_count", len(results))
            search_span.set_attribute("top_score", results[0].score if results else 0)
        
        # Reranking step
        with tracer.start_as_current_span("rerank") as rerank_span:
            reranked = await reranker.rerank(query, results)
            rerank_span.set_attribute("reranked_count", len(reranked))
        
        # Generation step
        with tracer.start_as_current_span("generate") as gen_span:
            response = await llm.generate(query, context=reranked[:5])
            gen_span.set_attribute("model", llm.model)
            gen_span.set_attribute("output_tokens", count_tokens(response))
        
        return response
```

</div>

برای نام‌گذاری ویژگی‌ها (Attributes)، به جای ابداع نام‌های اختصاصی، از قراردادهای معنایی GenAI در OpenTelemetry (`gen_ai.*`) پیروی کنید؛ بک‌اندهای تخصصی LLM نماهای خود را بر پایه آن‌ها تنظیم می‌کنند، و SDKهای نسخه ۴ و ۵ ابزار Langfuse به صورت پیش‌فرض تنها Spanهای مربوط به Langfuse، `gen_ai.*` و ابزاردقیق‌های شناخته‌شده LLM را صادر می‌کنند (فیلتر نسخه ۵ نیازمند پیشوند `gen_ai.` همراه با نقطه است).

### زمانی که ابزار دقیق خاموش می‌شود <a id="when-instrumentation-goes-silent"></a>

خطرناک‌ترین شکست در مشاهده‌پذیری، یک داشبورد ساکت است که ظاهر سالمی دارد. در اوت ۲۰۲۶ هر دو SDK اصلی پایتون ارائه‌دهندگان مدل، لایه HTTP خود را که ابزارهای ردیابی و تست به آن متصل می‌شدند تغییر دادند: پایتون SDK شرکت OpenAI نسخه 3.0.0 (۱۲ اوت) کلاینت پیش‌فرض خود را به `httpx2` تغییر داد و نصب `httpx` را متوقف کرد، و پایتون SDK شرکت Anthropic نسخه 1.0.0 (۲۰ اوت) نیز به `httpx2` مهاجرت نمود. راهنمای مهاجرت Anthropic هشدار می‌دهد که ابزاردقیق HTTPX در OpenTelemetry، یکپارچه‌سازی httpx در Sentry، و کتابخانه‌های `respx`، `pytest-httpx` و `vcrpy` ممکن است درخواست‌های SDK را بدون هیچ خطایی از دست بدهند، مگر اینکه پیش از وارد کردن (Import) ماژول `httpx` تابع `httpx2.alias_httpx()` اجرا شود. نتیجه این اتفاق، ناپدید شدن Spanها در محیط عملیاتی و اجرای درخواست‌های واقعی بدون Mock شدن در تست‌هاست، آن هم بدون نمایش هیچ خطایی.

دو کنترل جلوی این دسته از خطاها را می‌گیرد:

- **قناری تله‌متری در CI (Telemetry canary):** یک تست در خط لوله CI، یک فراخوانی واقعی (یا ضبط‌شده) به مدل از طریق کلاینت محیط عملیاتی انجام داده و بررسی می‌کند که Span مورد انتظار، تعداد Tokenها و متریک هزینه حتماً صادر شده باشند. این تست را روی هر ارتقای وابستگی‌ها اجرا کنید.
- **تطبیق روزانه (Daily reconciliation):** تعداد Tokenها و هزینه‌های دلاری ثبت‌شده در تله‌متری خود را با خروجی مصرف یا صورتحساب ارائه‌دهنده مقایسه نمایید. اختلاف بیش از چند درصد به معنای توقف گزارش‌دهی در بخشی از سیستم است.

---

## متریک‌های کلیدی <a id="key-metrics"></a>

### متریک‌های عملیاتی

| متریک | توضیحات | آستانه هشدار متداول |
|-------|---------|---------------------|
| نرخ درخواست (Request rate) | تعداد درخواست در ثانیه | تشخیص ناهنجاری (Anomaly detection) |
| نرخ خطا (Error rate) | درخواست‌های ناموفق / کل درخواست‌ها | بیش از ۵٪ |
| تاخیر صدک ۵۰ (Latency p50) | میانه زمان پاسخ‌دهی | بیش از ۲ ثانیه |
| تاخیر صدک ۹۵ (Latency p95) | صدک ۹۵ام زمان پاسخ‌دهی | بیش از ۵ ثانیه |
| تاخیر صدک ۹۹ (Latency p99) | صدک ۹۹ام زمان پاسخ‌دهی | بیش از ۱۰ ثانیه |
| زمان تا اولین توکن (TTFT) | زمان رسیدن اولین Token | بیش از ۱ ثانیه |
| توان عملیاتی توکن (Token throughput) | تعداد Token در ثانیه | کمتر از خط مبنا (Baseline) |

### متریک‌های کیفیت

| متریک | توضیحات | روش جمع‌آوری |
|-------|---------|--------------|
| امتیاز کیفیت (Quality score) | امتیازدهی به روش LLM به عنوان داور | نمونه‌برداری‌شده (۱ تا ۵ درصد) |
| وفاداری به متن (Faithfulness) | اتکای پاسخ RAG به کانتکست بازیابی‌شده | نمونه‌برداری‌شده |
| مرتبط بودن (Relevance) | میزان پاسخ‌گویی به پرسش اصلی | نمونه‌برداری‌شده |
| رضایت کاربر (User satisfaction) | لایک/دیس‌لایک و امتیازهای کاربران | بازخورد مستقیم کاربر |
| تکمیل وظیفه (Task completion) | آیا کاربر به هدف خود رسید؟ | سیگنال‌های ضمنی |

### متریک‌های هزینه

| متریک | توضیحات | سطح تفکیک (Granularity) |
|-------|---------|-------------------------|
| هزینه به ازای هر درخواست (Cost per request) | میانگین هزینه | به تفکیک مدل |
| هزینه روزانه (Daily cost) | کل هزینه مصرفی روزانه | کلی + به تفکیک مدل |
| هزینه به ازای هر اقدام کاربر (Cost per user action) | هزینه لازم برای تکمیل هدف کاربر | به تفکیک نوع تسک |
| هزینه به ازای هر تسک حل‌شده (Cost per resolved task) | مجموع هزینه تقسیم بر تسک‌هایی که واقعاً با موفقیت انجام شدند | به تفکیک Agent و مدل |
| نرخ اصابت کش (Cache hit rate) | تعداد Token ورودی کش‌شده / کل Tokenهای ورودی | به تفکیک مدل و قالب Prompt |
| بهره‌وری توکن (Token efficiency) | ارزش ارائه‌شده به ازای هر Token | به تفکیک مورد کاربرد |

---

## پایش کیفیت (Quality Monitoring) <a id="quality-monitoring"></a>

### استراتژی نمونه‌برداری

<div dir="ltr">

```python
class QualitySampler:
    def __init__(self, model: str, sample_rate: float = 0.05):
        self.model = model
        self.sample_rate = sample_rate
        self.judge = LLMJudge()
    
    async def maybe_evaluate(
        self,
        request_id: str,
        query: str,
        context: list[str],
        response: str
    ):
        # Sample randomly
        if random.random() > self.sample_rate:
            return
        
        # Evaluate quality
        scores = await self.judge.evaluate(
            query=query,
            context=context,
            response=response,
            criteria=["relevance", "faithfulness", "helpfulness"]
        )
        
        # Record metrics
        for criterion, score in scores.items():
            quality_score.labels(
                model=self.model,
                criterion=criterion
            ).set(score)
        
        # Store for analysis
        await self.store_evaluation(request_id, scores)
```

</div>

### تشخیص انحراف (Drift Detection)

<div dir="ltr">

```python
class QualityDriftDetector:
    def __init__(self, window_size: int = 1000):
        self.window_size = window_size
        self.baseline_scores = []
        self.current_scores = []
    
    def add_score(self, score: float):
        self.current_scores.append(score)
        
        if len(self.current_scores) >= self.window_size:
            self.check_drift()
            self.current_scores = []
    
    def check_drift(self):
        if not self.baseline_scores:
            self.baseline_scores = self.current_scores.copy()
            return
        
        # Statistical test for drift
        baseline_mean = np.mean(self.baseline_scores)
        current_mean = np.mean(self.current_scores)
        
        # Simple threshold-based detection
        drift_threshold = 0.1  # 10% degradation
        if (baseline_mean - current_mean) / baseline_mean > drift_threshold:
            self.alert_drift(baseline_mean, current_mean)
    
    def alert_drift(self, baseline: float, current: float):
        alert = {
            "type": "quality_drift",
            "baseline_score": baseline,
            "current_score": current,
            "degradation_pct": (baseline - current) / baseline * 100
        }
        self.send_alert(alert)
```

</div>

---

## ردیابی هزینه (Cost Tracking) <a id="cost-tracking"></a>

### محاسبه بلادرنگ هزینه

<div dir="ltr">

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Rate:
    """USD per 1M tokens."""
    input: float        # uncached input
    output: float       # output, including reasoning tokens
    cache_read: float   # input served from the prompt cache
    cache_write: float  # input written to the cache (Anthropic 5-minute tier; OpenAI 1.25x on the 30-minute cache, 2.5x on the 12-hour option)

class CostTracker:
    # Standard-tier list prices, November 2026. Load these from config in production:
    # promotions, long-context tiers, speed tiers, and residency premiums change monthly.
    # claude-haiku-5-5 ($0.10/$0.50, cache read $0.01) holds only up to a 100K-token prompt;
    # above that the whole request bills $0.50/$2.50, so it needs a tiered rate, not one Rate.
    PRICING = {
        "claude-opus-5-5":   Rate(input=4.00, output=20.00, cache_read=0.20, cache_write=5.00),
        "claude-sonnet-5-5": Rate(input=2.00, output=10.00, cache_read=0.10, cache_write=2.50),
        "gpt-6-sol":         Rate(input=2.00, output=10.00, cache_read=0.20, cache_write=2.50),
        "gpt-6-luna":        Rate(input=0.10, output=0.50,  cache_read=0.01, cache_write=0.125),
    }

    BUCKETS = ("uncached_input", "cache_read", "cache_write", "output")

    def track(self, model: str, usage: dict, request_id: str) -> float:
        # `usage` must already be split into the four disjoint BUCKETS. Providers
        # disagree on whether cached tokens are counted inside the input total,
        # so normalize per provider upstream or you will double-count.
        rate = self.PRICING.get(model)
        if rate is None:
            # Never price an unknown model at $0: that hides the most expensive mistakes.
            raise KeyError(f"No price configured for {model!r}")

        total_cost = (
            usage["uncached_input"] * rate.input
            + usage["cache_read"] * rate.cache_read
            + usage["cache_write"] * rate.cache_write
            + usage["output"] * rate.output
        ) / 1_000_000

        # Record metrics
        llm_cost_dollars.labels(model=model).inc(total_cost)
        for bucket in self.BUCKETS:
            tokens_used_total.labels(model=model, direction=bucket).inc(usage[bucket])

        # Log for analysis
        self.log_cost(request_id, model, usage, total_cost)

        return total_cost
```

</div>

چهار قاعده صورتحساب، محاسبات ساده‌انگارانه به ازای هر Token را بر هم می‌زنند:

- **خواندن از کش بر صورتحساب Agentها مسلط است.** داده‌های تجمیعی استفاده از Claude Code شرکت Anthropic (منتشرشده در ۲۴ سپتامبر ۲۰۲۶، گزارش‌شده توسط ارائه‌دهنده) نسبت Token ورودی به خروجی را ۳۲۴ به ۱ نشان می‌دهد که نسبت به ۱۸۹ به ۱ در ماه مارس افزایش یافته است. در چنین نسبتی، قیمت ورودی کش‌شده و نرخ اصابت کش (Cache hit rate) بسیار بیشتر از قیمت خروجی بر هزینه نهایی اثر می‌گذارند. تخفیف‌های خواندن از کش نیز بر اساس مدل متفاوت است: بیشتر مدل‌های Claude خواندن از کش را با ضریب ۰.۱ برابر ورودی محاسبه می‌کنند، مدل‌های Opus 5.5 و Sonnet 5.5 با ضریب ۰.۰۵ (ضریب Sonnet در ۷ اکتبر ۲۰۲۶ از ۰.۱ به این عدد کاهش یافت) و Fable 5.1 با ضریب ۰.۰۲۵ محاسبه می‌شوند. ضرایب نوشتن در کش نیز متغیرند: گزینه کش ۱۲ ساعته OpenAI (۲۰ اکتبر ۲۰۲۶) نوشتن را با ضریب ۲.۵ برابر ورودی محاسبه می‌کند.
- **سطوح کانتکست طولانی (Long-context tiers) کل درخواست را دوباره قیمت‌گذاری می‌کنند.** شرکت OpenAI به محض عبور ورودی از ۲۷۲ هزار Token کل درخواست را با نرخ‌های کانتکست طولانی محاسبه می‌کند (GPT-6 Sol از ۲/۱۰ دلار به ۴/۱۵ دلار می‌رسد)، و xAI در مدل Grok 4.7 برای Promptهای ۲۰۰ هزار Token به بالا هر Token را ۲ برابر حساب می‌کند. مدل‌های ۴.۶ و جدیدتر Anthropic تا ۱ میلیون Token نرخ ثابتی دارند با یک استثنا: مدل Claude Haiku 5.5 تا سقف Prompt صد هزار توکنی ۰.۱۰/۰.۵۰ دلار محاسبه می‌کند و بالای آن کل درخواست را ۰.۵۰/۲.۵۰ دلار حساب می‌نماید، و طول Prompt شامل خواندن و نوشتن کش نیز می‌شود. طول Prompt را به ازای هر درخواست لاگ کنید، وگرنه بدون تغییر ترافیک، قبض یک مدل ارزان‌قیمت ناگهان ۵ برابر جهش خواهد کرد.
- **سطوح سرعت و محل استقرار داده (Speed and residency tiers) نرخ را ضرب می‌کنند.** سطح Fast شرکت OpenAI دو برابر است (سطح Ultrafast در GPT-6 Astra شش برابر است و GPT-6.1 Sol Ultrafast از ۸ اکتبر ۲۰۲۶ برای تمام کاربران API با قیمت ۱۲/۶۰ دلار عرضه می‌شود)، و گزینه‌های اقامت داده (Data-residency) حدود ۱۰ درصد بالاتر از نرخ عادی هستند (تنظیم `inference_geo: "us"` در Anthropic دارای ضریب ۱.۱ برابر است).
- **تخفیف‌های تبلیغاتی منقضی می‌شوند.** قیمت ۲/۱۰ دلاری مدل Gemini 4 Argon تا ۳۰ نوامبر ۲۰۲۶ اعتبار دارد و در ۱ دسامبر به ۴/۲۰ دلار تبدیل می‌شود؛ قیمت معرفی ۰.۷۵/۳.۷۵ دلاری Gemini 3.8 Flash تا ۳۱ دسامبر ۲۰۲۶ برقرار است و در ۱ ژانویه ۲۰۲۷ به ۱.۵۰/۷.۵۰ دلار می‌رسد. بودجه‌بندی خود را بر اساس قیمت‌های رسمی لیست (List prices) انجام دهید.

بنابراین هر رکورد هزینه را با برچسب‌های سطح (Tier)، منطقه جغرافیایی و دسته‌های کش (Cache buckets) نشانه‌گذاری کنید و نرخ اصابت کش را در همان داشبورد هزینه‌ها قرار دهید.

### تخصیص هزینه (Cost Attribution)

<div dir="ltr">

```python
class CostAttributor:
    def attribute_cost(
        self,
        request_id: str,
        user_id: str,
        team: str,
        use_case: str,
        cost: float
    ):
        # Store for billing and analysis
        attribution = {
            "request_id": request_id,
            "user_id": user_id,
            "team": team,
            "use_case": use_case,
            "cost": cost,
            "timestamp": datetime.utcnow()
        }
        
        self.store(attribution)
        
        # Update running totals
        self.update_user_total(user_id, cost)
        self.update_team_total(team, cost)
        
        # Check budgets
        if self.exceeds_budget(team):
            self.alert_budget_exceeded(team)
```

</div>

---

## استراتژی هشداردهی (Alerting Strategy) <a id="alerting-strategy"></a>

### پیکربندی هشدارها

<div dir="ltr">

```yaml
alerts:
  # Availability
  - name: high_error_rate
    condition: error_rate > 0.05
    for: 5m
    severity: critical
    runbook: "Check provider status, verify API keys, review recent changes, fail over to a different vendor"
    
  # Latency
  - name: high_latency_p95
    condition: latency_p95 > 10s
    for: 5m
    severity: warning
    runbook: "Check model, reduce context size, verify provider status"
    
  # Cost
  - name: cost_spike
    condition: hourly_cost > 2 * rolling_avg_hourly_cost
    for: 1h
    severity: warning
    runbook: "Check for traffic spike, review recent deployments, verify caching"

  - name: cache_hit_rate_drop
    condition: cache_hit_rate < baseline_cache_hit_rate - 0.15
    for: 1h
    severity: warning
    runbook: "Diff the prompt prefix (tool order, timestamps, injected IDs), check for a model or SDK change"

  - name: served_model_changed
    condition: served_model != pinned_model
    for: 5m
    severity: warning
    runbook: "Check provider changelog and gateway routing; re-run the regression suite before accepting"
    
  # Quality
  - name: quality_degradation
    condition: avg_quality_score < 3.5 over 1h
    for: 30m
    severity: warning
    runbook: "Review recent changes, check model performance, sample responses"
    
  # Resource
  - name: rate_limit_approaching
    condition: rate_limit_usage > 0.8
    for: 15m
    severity: warning
    runbook: "Consider model routing, implement backpressure"
```

</div>

### اولویت‌بندی هشدارها

| شدت (Severity) | زمان پاسخ‌گویی | نمونه‌ها |
|----------------|----------------|----------|
| بحرانی (Critical) | کمتر از ۱۵ دقیقه | از کار افتادن سرویس، نرخ خطای بالای ۵۰٪ |
| بالا (High) | کمتر از ۱ ساعت | نرخ خطای بالای ۱۰٪، تاخیر P99 بالای ۳۰ ثانیه |
| هشدار (Warning) | کمتر از ۴ ساعت | افت کیفیت، جهش ناگهانی هزینه |
| اطلاع‌رسانی (Info) | روز کاری بعدی | تغییرات روند، برنامه‌ریزی ظرفیت |

سطح بحرانی خود را بر اساس قطعی‌های سراسری ارائه‌دهنده برنامه‌ریزی کنید، نه صرفاً خطای یک مدل منفرد. بین ۱۶ اوت تا ۲۹ سپتامبر ۲۰۲۶، صفحه وضعیت Anthropic حداقل ۱۲ حادثه بزرگ یا بحرانی را ثبت کرد، و حادثه ۲۹ سپتامبر OpenAI همزمان API، سرویس ChatGPT و Codex را حدود ۵ ساعت و ۲۰ دقیقه دچار اختلال نمود. هنگامی که یک قطعی همزمان API و عامل کدنویسی یک ارائه‌دهنده را از کار می‌اندازد، زنجیره بازگشت اضطراری (Fallback) که درون همان ارائه‌دهنده باقی بماند کمکی نمی‌کند؛ مسیریابی را میان ارائه‌دهندگان مختلف انجام دهید و روی نرخ استفاده از Fallback هشدار تنظیم کنید تا متوجه شوید چه زمانی سیستم روی مسیر پشتیبان قرار دارد.

---

## ابزارهای مشاهده‌پذیری <a id="observability-tools"></a>

### ابزارهای تخصصی LLM

| ابزار | تمرکز اصلی | بهترین کاربرد | نکات قابل توجه |
|-------|------------|---------------|-----------------|
| ابزار LangSmith | ردیابی و ارزیابی؛ قابلیت تبدیل Trace به Fine-tuning در بتای عمومی از ۲۴ سپتامبر ۲۰۲۶ | برنامه‌های LangChain و LangGraph | قیمت‌گذاری مبتنی بر مصرف بر حسب واحد استاندارد LangChain (معادل ۱ LSU = ۱ دلار) از ۱ اکتبر ۲۰۲۶ جایگزین قیمت‌گذاری به ازای اجرا و آپتایم شد، بنابراین حجم Trace خود را دوباره برآورد کنید؛ Traceهای نسخه SaaS با نگهداری توسعه‌یافته از ۱۴ سپتامبر ۲۰۲۶ حداکثر ۱۸۰ روز نگهداری می‌شوند (نسخه‌های self-hosted و BYOC بدون تغییر مانده‌اند) |
| ابزار Langfuse | ردیابی و ارزیابی متن‌باز مبتنی بر OpenTelemetry؛ درگاه AI Gateway در بتای عمومی از ۴ نوامبر ۲۰۲۶ | استقرار خودمیزبان (Self-hosted) و حریم خصوصی | از ژانویه ۲۰۲۶ بخشی از ClickHouse شده است؛ اکنون با دستور `pip install langfuse` نسخه ۵ پایتون SDK (منتشرشده در ۱۴ اکتبر ۲۰۲۶) نصب می‌شود که مسیرهای کد نسخه ۴ را می‌شکند (توضیحات پایین را ببینید). این درگاه درخواست‌های بومی OpenAI و Anthropic را با کلیدهای ذخیره‌شده در Langfuse هدایت و هر فراخوانی را ردیابی می‌کند: تخصیص هزینه ساده‌تر است، اما نگهداری کلیدها و هر Prompt اکنون نزد ارائه‌دهنده ابزار ردیابی شما قرار می‌گیرد |
| ابزار Weights & Biases | ردیابی آزمایش‌ها؛ ابزار Weave برای ردیابی و ارزیابی LLM | تیم‌های ML که اجراهای آموزش و Fine-tuning را نیز ردیابی می‌کنند | از سال ۲۰۲۵ بخشی از CoreWeave است |
| ابزار Arize Phoenix | ردیابی و ارزیابی LLM | پایش محیط عملیاتی | دارای مجوز Elastic-2.0 (کد منبع در دسترس، نه متن‌باز با تاییدیه OSI)؛ شرکت Dynatrace در ۱ اکتبر ۲۰۲۶ خرید ۹۱۵ میلیون دلاری Arize را تکمیل کرد و اعلام کرده که Phoenix همچنان در دسترس باقی می‌ماند |
| ابزار Helicone | لاگ‌گیری پروکسی API | یکپارچه‌سازی ساده | توسط Mintlify تصاحب شده است (اعلام‌شده در مارس ۲۰۲۶)؛ پیش از انتخاب از نقشه راه آن مطمئن شوید |

**بر اساس قابلیت خروج (Exit) انتخاب کنید، نه صرفاً ویژگی‌ها.** این لایه به سرعت در حال ادغام است، بنابراین ریسک ارائه‌دهنده یکی از معیارهای اصلی انتخاب محسوب می‌شود. داده‌های OpenTelemetry را با ویژگی‌های `gen_ai.*` مستقیماً از کد خود صادر کنید تا بتوانید بک‌اندها را تعویض نمایید، Traceهای مورد نیاز برای ممیزی یا انطباق قانونی را در فضای ذخیره‌سازی تحت کنترل خود نگه دارید (یک مخزن ردیابی SaaS با سقف ۱۸۰ روزه جایگزین لاگ ممیزی نیست)، و مجموعه‌داده‌های ارزیابی و Promptهای داور را در فرمتی که مالک آن هستید خروجی بگیرید.

### مثال یکپارچه‌سازی: ابزار Langfuse (پایتون SDK نسخه ۴)

نسخه پایتون SDK ابزار Langfuse از زمان بازنویسی v3 (ژوئن ۲۰۲۵) مبتنی بر OpenTelemetry بوده است. مثال زیر مربوط به کد نسخه ۴ است، بنابراین برای اجرای آن به همین شکل نسخه `langfuse>=4,<5` را پین کنید: نسخه ۵ در ۱۴ اکتبر ۲۰۲۶ منتشر شد و دستور `pip install langfuse` اکنون روی پایتون ۳.۱۱ و بالاتر به نسخه ۵ (5.2.0 در ۵ نوامبر) اشاره می‌کند. نسخه ۵ نیازمند سرور Langfuse Cloud یا سرور خودمیزبان نسخه 4.59.0 به بالا است (نسخه ۳ خودمیزبان پشتیبانی نمی‌شود)، متد `api.scores_v3.get_many_v3()` را بدون نام مستعار حذف کرده (از `api.scores.get_many()` استفاده کنید) به همراه حذف `api.trace.get/list`، `api.sessions`، `api.legacy.*`، `api.ingestion.batch`، `set_current_trace_io()` و `span.set_trace_io()`، مقادیر متادیتا را در ویژگی‌های Span به صورت JSON کدگذاری می‌کند، و دسته‌های Span را با gzip فشرده می‌سازد. پیش از انتقال کد، [راهنمای ارتقای نسخه ۴ به ۵](https://langfuse.com/docs/observability/sdk/upgrade-path/python-v4-to-v5) را بخوانید. الگوی نسخه ۲ در آموزش‌های قدیمی (`langfuse.trace()`، `trace.span()`، `trace.generation()`، `span.end()`) منسوخ شده است؛ از دکوریتور `@observe()` و متد `start_as_current_observation()` استفاده کنید:

<div dir="ltr">

```python
# pip install "langfuse>=4,<5"  (v4 API; see the v5 notes above)
from langfuse import get_client, observe, propagate_attributes

langfuse = get_client()  # credentials from the LANGFUSE_* environment variables

@observe(name="rag_query")  # root observation; captures input and return value
async def traced_rag_query(query: str, user_id: str, session_id: str) -> str:
    with propagate_attributes(user_id=user_id, session_id=session_id):
        with langfuse.start_as_current_observation(as_type="span", name="retrieve") as span:
            embedding = await embed(query)
            results = await vector_db.search(embedding, top_k=10)
            span.update(output={"count": len(results), "ids": [r.id for r in results]})

        context = results[:5]
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="generate",
            model="claude-sonnet-5-5",
            input={"query": query, "context": [r.text for r in context]},
        ) as gen:
            response = await llm.generate(query, context=context)
            gen.update(
                output=response.text,
                usage_details={  # Langfuse's own keys; flat buckets must not overlap
                    "input": response.usage.input_tokens,
                    "output": response.usage.output_tokens,
                },
            )

    return response.text
```

</div>

دو رفتار نسخه ۴ که باید بدانید: توابع دارای دکوریتور، آرگومان‌ها و مقادیر بازگشتی خود را ضبط می‌کنند، بنابراین بردارهای امبدینگ، اسناد خام و فیلدهای حساس را خارج از امضای توابع تحت ردیابی نگه دارید یا آن‌ها را ماسک کنید. همچنین نسخه ۴ به صورت پیش‌فرض فقط Spanهای Langfuse، `gen_ai.*` و ابزاردقیق‌های شناخته‌شده LLM را صادر می‌کند، پس Spanهای پایگاه داده و HTTP از همان پردازش نمایش داده نخواهند شد مگر اینکه فیلتر را گسترش دهید.

---

## پرسش‌های مصاحبه (Interview Questions) <a id="interview-questions"></a>

### پرسش: چه متریک‌هایی را برای یک سیستم LLM عملیاتی ردیابی می‌کنید؟

**پاسخ قوی:**

«من متریک‌ها را در سه دسته سازمان‌دهی می‌کنم:

**متریک‌های عملیاتی:** این موارد پایه و اساس هر سرویس نرم‌افزاری هستند.
- نرخ درخواست و نرخ خطا
- صدک‌های تاخیر (Latency): p50، p95 و p99
- زمان تا اولین توکن (TTFT) برای استریمینگ
- دسترسی‌پذیری (Availability)

**متریک‌های کیفیت:** این همان بخشی است که مشاهده‌پذیری LLM را منحصربه‌فرد می‌سازد.
- امتیازهای کیفیت نمونه‌برداری‌شده با روش LLM به عنوان داور (نرخ نمونه‌برداری ۱ تا ۵ درصد)
- بررسی‌های دودویی (نقض خط‌مشی‌ها، استنادهای جاافتاده) بر روی کل ترافیک با یک مدل داور تقطیرشده (Distilled) یا تصمیم‌گیر که اکنون آن‌قدر ارزان شده که اجرای آن روی ۱۰۰٪ ترافیک به‌صرفه است
- برای RAG: امتیازهای وفاداری به متن (Faithfulness) و مرتبط بودن (Relevance)
- بازخورد کاربر: لایک/دیس‌لایک و امتیازهای صریح
- نرخ تکمیل وظیفه در مواردی که قابل اندازه‌گیری باشد

**متریک‌های هزینه:**
- هزینه به ازای هر درخواست بر اساس مدل
- روندهای هزینه روزانه و هفتگی
- هزینه به ازای هر اقدام موفق کاربر
- بهره‌وری توکن (Token efficiency)

من هشدارهایی را برای مسائل عملیاتی (نرخ خطا بیشتر از ۵٪، P95 فراتر از SLA) و انحراف کیفیت (افت ۱۰ درصدی میانگین امتیاز از خط مبنا) تنظیم می‌کنم. هشدارهای جهش هزینه نیز به شناسایی مصرف بی‌رویه کمک می‌کنند.

نکته کلیدی این است که یک سیستم LLM سریع و همیشه در دسترس که خروجی‌های بد تولید کند همچنان یک سیستم شکست‌خورده است. کیفیت باید یک متریک درجه یک باشد.»

### پرسش: چگونه افت کیفیت را در محیط عملیاتی تشخیص می‌دهید؟

**پاسخ قوی:**

«من از چندین رویکرد ترکیبی استفاده می‌کنم:

**نمونه‌برداری مستمر:** ۱ تا ۵ درصد از درخواست‌ها را با استفاده از LLM به عنوان داور ارزیابی می‌کنم. این کار بدون نیاز به ارزیابی کل ترافیک، یک سیگنال کیفی به من می‌دهد.

**تشخیص انحراف (Drift detection):** یک توزیع پایه از کیفیت را نگهداری می‌کنم و از آزمون‌های آماری برای تشخیص انحراف معنادار امتیازهای فعلی بهره می‌برم. افت ۱۰ درصدی یک هشدار فعال می‌کند.

**بازخورد کاربر:** دکمه‌های لایک/دیس‌لایک یا امتیازهای صریح در صورت وجود. این داده‌ها حقیقت مبنا برای رضایت واقعی کاربر هستند.

**سیگنال‌های ضمنی:** تکمیل وظیفه، نرخ تلاش مجدد، نرخ ارجاع به پشتیبان انسانی و طول نشست. اگر کاربران بیشتر به مشکل برمی‌خورند، احتمالاً کیفیت افت کرده است.

**اقدامات لازم هنگام تشخیص افت کیفیت:**
1. بررسی استقرارهای اخیر یا تغییرات Promptها
2. نمونه‌برداری از پاسخ‌های خاص برای عیب‌یابی مشکل
3. بررسی اینکه مشکل مختص یک مدل خاص (مسئله ارائه‌دهنده) است یا همگانی است
4. بازگرداندن نسخه (Rollback) در صورت لزوم و سپس بررسی ریشه‌ای

من همچنین یک مجموعه تست طلایی (Golden test set) از پرسش‌ها با رفتارهای مورد انتظار را نگه می‌دارم که روی هر استقرار اجرا می‌شود تا افت کیفیت پیش از رسیدن به محیط عملیاتی شناسایی گردد.»

### پرسش: پس از یک ارتقای معمول وابستگی‌ها، داشبوردهای LLM شما ساکت می‌شوند: Spanهای کمتر و شمارش توکن پایین‌تر، در حالی که ترافیک و صورتحساب ارائه‌دهنده تغییر نکرده است. چه اتفاقی افتاده و چگونه از تکرار آن جلوگیری می‌کنید؟

**پاسخ قوی:**

«ثابت ماندن صورتحساب همزمان با کاهش تله‌متری به معنای شکستن ابزاردقیق (Instrumentation) است، نه افت ترافیک. نخستین مظنون من لایه انتقال HTTP است. در اوت ۲۰۲۶، هر دو پایتون SDK شرکت OpenAI نسخه 3.0 و پایتون SDK شرکت Anthropic نسخه 1.0 به `httpx2` مهاجرت کردند، و ابزاردقیقی که به `httpx` متصل می‌شود (ابزاردقیق HTTPX در OpenTelemetry، یکپارچه‌سازی Sentry و کتابخانه‌های Mock مثل `respx` و `vcrpy`) می‌تواند فراخوانی‌های SDK را بی‌سروصدا از دست بدهد، مگر اینکه `httpx2.alias_httpx()` پیش از وارد کردن `httpx` اجرا شود. سایر مظنون‌های دارای علائم مشابه عبارتند از: ارتقای نسخه اصلی SDK ردیابی که API یا فیلتر پیش‌فرض Span خود را تغییر داده باشد، یا تغییر پیکربندی نمونه‌برداری (Sampling) همراه با ارتقا.

برای تایید، یک روز از خروجی مصرف ارائه‌دهنده را با متریک‌های Token خود مقایسه می‌کنم، سپس یک فراخوانی آزمایشی در محیط Staging انجام می‌دهم و بررسی می‌کنم آیا Span آن ظاهر می‌شود یا خیر.

برای جلوگیری از تکرار این مشکل:
1. **قناری تله‌متری در CI:** یک تست فراخوانی مدل را از طریق کلاینت محیط عملیاتی انجام داده و تضمین می‌کند که Span، شمارش Tokenها و متریک هزینه صادر شده‌اند. این تست روی هر به‌روزرسانی وابستگی‌ها اجرا می‌شود.
2. **تطبیق روزانه:** مقایسه Tokenها و هزینه‌های دلاری تله‌متری با خروجی صورتحساب ارائه‌دهنده، و ارسال هشدار در صورت اختلاف بیش از چند درصد.
3. **ارتقا به صورت یک بسته واحد:** SDKهای ارائه‌دهنده، کلاینت HTTP و بسته‌های ابزاردقیق با هم پین (Pin) شده و همزمان با هم ارتقا می‌یابند.

درس کلی این است که مشاهده‌پذیری نیز به تست‌های اختصاصی خود نیاز دارد. داشبوردی بدون خطا تنها زمانی خبر خوب است که ثابت کرده باشید در صورت بروز خطا آن را نمایش می‌دهد.»

---

## منابع و مراجع (References) <a id="references"></a>

- پلتفرم OpenTelemetry: https://opentelemetry.io/
- قراردادهای معنایی GenAI در OpenTelemetry: https://opentelemetry.io/docs/specs/semconv/gen-ai/
- مستندات ابزار Langfuse: https://langfuse.com/docs
- راهنمای ارتقای نسخه ۳ به ۴ پایتون SDK در Langfuse: https://langfuse.com/docs/observability/sdk/upgrade-path/python-v3-to-v4
- راهنمای ارتقای نسخه ۴ به ۵ پایتون SDK در Langfuse: https://langfuse.com/docs/observability/sdk/upgrade-path/python-v4-to-v5
- مقاله Langfuse پیرامون «نسخه بتای عمومی AI Gateway» (۴ نوامبر ۲۰۲۶): https://langfuse.com/changelog/2026-11-04-ai-gateway-public-beta
- مستندات ابزار LangSmith: https://docs.smith.langchain.com/
- یادداشت‌های `httpx2` در پایتون SDK شرکت OpenAI: https://github.com/openai/openai-python/blob/main/httpx2.md

---

*بعدی: [بنچمارک‌ها و رتبه‌بندی‌ها (Benchmarks and Leaderboards)](03-benchmarks-and-leaderboards.md)*

</div>
