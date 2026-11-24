<div dir="rtl">

# الگوهای پایایی و تاب‌آوری (Reliability Patterns)

سیستم‌های LLM در محیط پروداکشن به الگوهای پایایی فراتر از منطق ساده تلاش مجدد (Retry) نیاز دارند. این فصل الگوهای پیشرفته برای ساخت برنامه‌های هوش مصنوعی تاب‌آور را پوشش می‌دهد.

## فهرست مطالب

- [چالش‌های پایایی و تاب‌آوری (Reliability Challenges)](#چالشهای-پایایی-و-تابآوری-reliability-challenges)
- [الگوهای تلاش مجدد (Retry Patterns)](#الگوهای-تلاش-مجدد-retry-patterns)
- [قطع‌کننده مدار (Circuit Breaker)](#قطعکننده-مدار-circuit-breaker)
- [الگوی تیغه یا دیواره آتش (Bulkhead Pattern)](#الگوی-تیغه-یا-دیواره-آتش-bulkhead-pattern)
- [استراتژی‌های انقضای زمان (Timeout Strategies)](#استراتژیهای-انقضای-زمان-timeout-strategies)
- [کاهش تدریجی سطح خدمت (Graceful Degradation)](#کاهش-تدریجی-سطح-خدمت-graceful-degradation)
- [تغییر مسیر اضطراری میان چند ارائه‌دهنده (Multi-Provider Failover)](#تغییر-مسیر-اضطراری-میان-چند-ارائهدهنده-multi-provider-failover)
- [پرسش‌های مصاحبه (Interview Questions)](#پرسشهای-مصاحبه-interview-questions)
- [مراجع (References)](#مراجع-references)

---

## چالش‌های پایایی و تاب‌آوری (Reliability Challenges)

### حالت‌های شکست خاص LLM

| حالت شکست (Failure Mode) | علت رخداد | پیامد و اثر (Impact) |
|---|---|---|
| محدودیت نرخ (Rate limiting) | اتمام سهمیه (Quota)، افزایش بسیار سریع ترافیک | رد شدن درخواست |
| سقف بودجه و هزینه (Spend cap) | رسیدن به سقف بودجه ماهانه | خطای 429 که هیچ تلاش مجددی آن را رفع نمی‌کند تا زمان ریست شدن یا افزایش سقف |
| انقضای زمان (Timeouts) | تولید طولانی خروجی، مشکلات شبکه | پاسخ‌های کند یا با شکست مواجه‌شده |
| قطعی ارائه‌دهنده (Provider outage) | اختلالات و مشکلات زیرساختی ارائه‌دهنده | شکست و توقف کامل سرویس |
| افت کیفیت خروجی (Quality degradation) | به‌روزرسانی مدل‌ها (گاهی تحت شناسه مدل یکسان)، تغییر مدل پیش‌فرض SDK، بار کاری بالا | خروجی‌های ضعیف‌تر بدون بروز هیچ‌گونه خطای نرم‌افزاری |
| بازنشستگی مدل (Model retirement) | خاموشی زمان‌بندی‌شده یک شناسه مدل (مانند `claude-sonnet-4-5-20250929` در ۳۰ نوامبر ۲۰۲۶) | خطاهای سخت در تاریخی که از قبل اعلام شده است (Anthropic حداقل ۶۰ روز، OpenAI شش ماه برای مدل‌های GA و تا دو هفته برای پیش‌نمایش‌ها مهلت می‌دهد) |
| امتناع‌های ایمنی (Safety refusal) | رد درخواست توسط طبقه‌بند ارائه‌دهنده | پاسخ HTTP 200 با محتوای خالی که شبیه به موفقیت به نظر می‌رسد |
| سرریز کانتکست (Context overflow) | ورودی بیش از حد بزرگ | شکست پردازش درخواست |
| خروجی بدشکل (Malformed output) | خطاهای ساختاری در فرآیند تولید | شکست در پارس کردن داده‌ها |

دو مورد از این سطرها به سادگی نادیده گرفته می‌شوند زیرا هیچ استثنایی (Exception) پرتاب نمی‌کنند. **تغییرات خاموش کیفیت** تحت شناسه‌های ثابت مدل رخ می‌دهند: مدل‌های GPT-6 Sol و GPT-6 Luna در ۲۲ سپتامبر ۲۰۲۶ با یک باگ انکودینگ تصویر عرضه شدند که درک تصویر و تعامل با کامپیوتر را تضعیف می‌کرد؛ OpenAI آن را در ۲۵ سپتامبر بدون تغییر اسنپ‌شات برطرف کرد و به مشتریان ورودی تصویر گفت ارزیابی‌های خود را دوباره اجرا کنند. تثبیت شناسه مدل تنها نام را ثابت می‌کند، نه پشته سروینگ را. پیش‌فرض‌ها نیز جابه‌جا می‌شوند: پکیج openai-agents نسخه 0.20.0 (۱۱ آگوست ۲۰۲۶) مدل `gpt-5.6-luna` را پیش‌فرض ضمنی خود قرار داد، بنابراین ایجنتی که نام مدل را قید نکرده بود با یک ارتقای وابستگی معمولی تغییر مدل داد. مدل را همیشه به‌صورت صریح در همه‌جا نام ببرید. **امتناع‌های ایمنی** در جدیدترین مدل‌های Claude به عنوان پاسخ‌های موفق با `stop_reason: "refusal"` می‌آیند، بنابراین منطق تلاش مجدد متکی بر خطا هرگز آنها را نمی‌بیند (بخش [مدیریت امتناع‌های ایمنی](#مدیریت-امتناعهای-ایمنی) را ببینید).

### اهداف پایایی و دسترسی‌پذیری

| رده خدمت (Tier) | دسترسی‌پذیری (Availability) | تاخیر در صدک ۹۹ (Latency p99) | نمونه‌های کاربرد |
|---|---|---|---|
| رده بحرانی (Critical) | دسترسی‌پذیری ۹۹.۹۹٪ | کمتر از ۳ ثانیه | پردازش پرداخت‌های مالی |
| رده استاندارد (Standard) | دسترسی‌پذیری ۹۹.۹٪ | کمتر از ۱۰ ثانیه | پشتیبانی مشتریان |
| رده بهترین تلاش (Best effort) | دسترسی‌پذیری ۹۹٪ | کمتر از ۳۰ ثانیه | کارهای پس‌زمینه (Background tasks) |

---

## الگوهای تلاش مجدد (Retry Patterns)

### عقب‌نشینی نمایی همراه با نوسان تصادفی (Exponential Backoff with Jitter)

<div dir="ltr">

```python
import random
import asyncio
from typing import TypeVar, Callable

T = TypeVar("T")

class RetryConfig:
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: float = 0.5
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
    
    def get_delay(self, attempt: int) -> float:
        delay = min(
            self.base_delay * (self.exponential_base ** attempt),
            self.max_delay
        )
        # Add jitter to prevent thundering herd
        jitter_range = delay * self.jitter
        delay += random.uniform(-jitter_range, jitter_range)
        return max(0, delay)


async def retry_with_backoff(
    func: Callable[[], T],
    config: RetryConfig,
    retryable_exceptions: tuple = (Exception,)
) -> T:
    last_exception = None
    
    for attempt in range(config.max_retries + 1):
        try:
            return await func()
        except retryable_exceptions as e:
            last_exception = e
            
            if attempt == config.max_retries:
                break
            
            delay = config.get_delay(attempt)
            await asyncio.sleep(delay)
    
    raise last_exception
```

</div>

### خطاهای قابل تکرار در برابر خطاهای غیرقابل تکرار

خطاها را بر اساس کد وضعیت HTTP **و** کد تفصیلی خطا طبقه‌بندی کنید. یک کد وضعیت واحد اکنون معانی متفاوتی دارد: از ۲ سپتامبر ۲۰۲۶، شرکت OpenAI خطای 429 را با کد `slow_down` در زمان اوج‌گیری سریع ترافیک و خطای 503 را در بار اضافه موقت مدل بازمی‌گرداند، که هر دو ممکن است هدر `Retry-After` داشته باشند. شرکت Anthropic خطای 429 را برای محدودیت‌های شتاب ترافیک بازمی‌گرداند، اما سقف بودجه ماهانه آن یک خطای 429 با کد `error_code: enforced_spend_limit_reached` و بدون `retry-after` است که هیچ تلاشی آن را پاک نمی‌کند تا زمانی که سقف ریست شود یا ادمین آن را بالا ببرد. سقف مصرف پایین‌تری که خودتان تنظیم می‌کنید متفاوت است: خطای 400 `invalid_request_error` برمی‌گرداند، بنابراین یک طبقه‌بند ممکن است این توقف سراسری را به عنوان یک درخواست نامعتبر تلقی کند. روی جهش ناگهانی خطاهای 400 هشدار بگذارید، نه فقط 429 و 5xx.

<div dir="ltr">

```python
from enum import Enum

class RetryAction(Enum):
    BACKOFF = "backoff"                      # same provider, exponential backoff + jitter
    FAILOVER = "failover"                    # next provider in the chain
    FAILOVER_AND_PAGE = "failover_and_page"  # will not clear on its own; a human must act
    DO_NOT_RETRY = "do_not_retry"            # fix the request

class LLMRetryPolicy:
    @staticmethod
    def classify(status: int, code: str | None) -> RetryAction:
        if status == 429 and code == "enforced_spend_limit_reached":
            return RetryAction.FAILOVER_AND_PAGE   # Anthropic spend cap
        if status == 429:
            return RetryAction.BACKOFF             # includes OpenAI "slow_down": ramp gently
        if status in (500, 502, 503, 504, 529):
            return RetryAction.BACKOFF             # overload or server error; fail over if it persists
        if status == 404:
            return RetryAction.FAILOVER            # retired or wrong model ID; then fix the registry
        return RetryAction.DO_NOT_RETRY            # auth, bad request, context too long

    @staticmethod
    def delay(retry_after_header: str | None, computed_backoff: float) -> float:
        # Never retry sooner than the provider asked
        if retry_after_header:
            return max(float(retry_after_header), computed_backoff)
        return computed_backoff
```

</div>

خطاهای تایم‌اوت و خطاهای اتصال به `BACKOFF` نگاشت می‌شوند. نادیده گرفتن `Retry-After` رایج‌ترین باگ در پیاده‌سازی عقب‌نشینی است؛ یکسان دانستن تمام خطاهای 429 دومین باگ رایج است.

### مدیریت امتناع‌های ایمنی (Handling Safety Refusals)

یک امتناع از جنس خطای انتقال شبکه نیست، بنابراین ماشین‌های تلاش مجدد بالا آن را نمی‌بینند. در مدل‌های Claude Fable 5.1 و 5، Opus 5.5 و 5، و Sonnet 5.5، رد درخواست توسط طبقه‌بند ایمنی پاسخی با کد وضعیت HTTP 200 همراه با `stop_reason: "refusal"`، محتوای خالی، و یک دسته‌بندی در `stop_details.category` است (`cyber`، `bio`، `frontier_llm`، `reasoning_extraction`، `general_harms`، یا `null`). تلاش مجدد همان درخواست روی همان مدل هدر دادن بودجه است؛ در عوض آن را هدایت کنید:

- **بازگشت اضطراری سمت سرور (بتای Claude API):** قابلیت `fallbacks: "default"` با هدر `server-side-fallback-2026-07-01` روی مدلی که Anthropic برای آن دسته توصیه می‌کند تلاش مجدد انجام می‌دهد، یا می‌توانید تا سه مقصد از لیست مجاز مدل نام ببرید (مقاصد مجاز Fable 5.1 شامل Opus 4.8 و Opus 5 هستند). این قابلیت فقط روی امتناع‌های طبقه‌بند عمل می‌کند؛ محدودیت‌های نرخ و اضافه بار بدون تغییر بازمی‌گردند. این امکان در Bedrock، Google Cloud، یا Foundry وجود ندارد و میدل‌ویر کلاینت SDK آن را انجام می‌دهد.
- **تخصیص ظرفیت برای محدودیت‌های نرخ مدل جایگزین:** اگر مدل فال‌بک دچار محدودیت نرخ یا اضافه بار باشد، API از تلاش صرف‌نظر کرده و امتناع اصلی را بازمی‌گرداند. هر تلاش در سقف مدل خود محاسبه می‌شود، بنابراین حجم امتناع‌ها به سهمیه مدل جایگزین وارد می‌شود.
- **انتظار هدایت چسبنده (Sticky routing):** هنگامی که یک مکالمه فال‌بک کرد، درخواست‌های بعدی آن که شامل `fallbacks` باشند مستقیماً به مدل فال‌بک می‌روند (این مسیریابی حدود یک ساعت نگه‌داری می‌شود). بنابراین به جای فرض اینکه مدل درخواستی پاسخ داده، فیلد `model` و `usage.iterations` پاسخ را بخوانید.
- **دسته `reasoning_extraction` فاقد مدل فال‌بک پیشنهادی است:** زمانی رخ می‌دهد که پرامپت از مدل بخواهد استدلال خود را بنویسد (یک بخش `<thinking>` یا فیلد `reasoning` در JSON). پرامپت را اصلاح کنید؛ دوباره امتحان نکنید.
- **امتناع‌ها هزینه و سهمیه مصرف می‌کنند:** از ۲۴ سپتامبر ۲۰۲۶، امتناع‌های پیش از خروجی در دسته‌های `bio`، `frontier_llm` و `reasoning_extraction` صورت‌حساب دارند و در سقف نرخ شمرده می‌شوند.

امتناع‌ها ارتباطی با سلامت ارائه‌دهنده ندارند، بنابراین نباید مدارشکن (Circuit breaker) را باز کنند. آنها را به تفکیک دسته مانیتور کنید؛ جهش ناگهانی نشانه تغییر پرامپت یا گاردریل است، نه قطعی سرویس.

---

## قطع‌کننده مدار (Circuit Breaker)

### پیاده‌سازی مدارشکن

<div dir="ltr">

```python
from enum import Enum
from dataclasses import dataclass
from datetime import datetime, timedelta

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery

@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    recovery_timeout: timedelta = timedelta(seconds=30)
    half_open_max_calls: int = 3
    success_threshold: int = 2  # Successes needed to close

class CircuitBreaker:
    def __init__(self, name: str, config: CircuitBreakerConfig):
        self.name = name
        self.config = config
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: datetime | None = None
        self.half_open_calls = 0
    
    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        
        if self.state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if self._recovery_timeout_elapsed():
                self._transition_to_half_open()
                self.half_open_calls += 1
                return True
            return False
        
        if self.state == CircuitState.HALF_OPEN:
            # Allow a limited number of probe calls in half-open state
            if self.half_open_calls < self.config.half_open_max_calls:
                self.half_open_calls += 1
                return True
            return False
        
        return False
    
    def record_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.config.success_threshold:
                self._transition_to_closed()
        else:
            self.failure_count = 0
    
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.state == CircuitState.HALF_OPEN:
            self._transition_to_open()
        elif self.failure_count >= self.config.failure_threshold:
            self._transition_to_open()
    
    def _transition_to_open(self):
        self.state = CircuitState.OPEN
        self.success_count = 0
    
    def _transition_to_half_open(self):
        self.state = CircuitState.HALF_OPEN
        self.half_open_calls = 0
        self.success_count = 0
    
    def _transition_to_closed(self):
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
    
    def _recovery_timeout_elapsed(self) -> bool:
        if self.last_failure_time is None:
            return True
        return datetime.now() - self.last_failure_time >= self.config.recovery_timeout
```

</div>

### نحوه استفاده به همراه کلاینت LLM

<div dir="ltr">

```python
class ResilientLLMClient:
    def __init__(self):
        self.circuit_breakers = {
            "openai": CircuitBreaker("openai", CircuitBreakerConfig()),
            "anthropic": CircuitBreaker("anthropic", CircuitBreakerConfig()),
        }
    
    async def generate(self, prompt: str, provider: str = "openai") -> str:
        cb = self.circuit_breakers[provider]
        
        if not cb.can_execute():
            raise CircuitOpenError(f"Circuit breaker open for {provider}")
        
        try:
            result = await self._call_provider(provider, prompt)
            cb.record_success()
            return result
        except RetryableError as e:
            cb.record_failure()
            raise
```

</div>

**تعیین کنید چه مواردی شکست به حساب می‌آیند:** خطاهای 5xx، اضافه بارها، تایم‌اوت‌ها، و خطاهای 429 که با وجود عقب‌نشینی ادامه می‌یابند را بشمارید. خطاهای کلاس 400 یا امتناع‌های ایمنی را نشمارید: آنها وضعیت درخواست را توصیف می‌کنند نه سلامت ارائه‌دهنده را، و شمردن آنها باعث می‌شود یک قالب پرامپت خراب مدارشکن را برای همه باز کند. خطای 429 ناشی از سقف بودجه استثنایی در جهت مخالف است: مدارشکن را اجباراً تا ریست شدن یا افزایش سقف باز نگه دارید، نه اینکه هر ۳۰ ثانیه پروب بفرستید.

---

## الگوی تیغه یا دیواره آتش (Bulkhead Pattern)

### ایزوله‌سازی منابع

<div dir="ltr">

```python
import asyncio
from contextlib import asynccontextmanager

class Bulkhead:
    """
    Isolate resources to prevent cascade failures.
    """
    
    def __init__(
        self,
        name: str,
        max_concurrent: int,
        max_queued: int = 100
    ):
        self.name = name
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.queue_semaphore = asyncio.Semaphore(max_queued)
    
    @asynccontextmanager
    async def acquire(self, timeout: float = 30.0):
        # Check queue capacity
        if not self.queue_semaphore.locked():
            await self.queue_semaphore.acquire()
        else:
            raise BulkheadFullError(f"Bulkhead {self.name} queue full")
        
        try:
            # Wait for execution slot
            acquired = await asyncio.wait_for(
                self.semaphore.acquire(),
                timeout=timeout
            )
            self.queue_semaphore.release()
            
            try:
                yield
            finally:
                self.semaphore.release()
        except asyncio.TimeoutError:
            self.queue_semaphore.release()
            raise BulkheadTimeoutError(f"Bulkhead {self.name} timeout")


class BulkheadedLLMClient:
    def __init__(self):
        # Separate bulkheads for different workloads
        self.bulkheads = {
            "realtime": Bulkhead("realtime", max_concurrent=50),
            "batch": Bulkhead("batch", max_concurrent=200),
            "critical": Bulkhead("critical", max_concurrent=10)
        }
    
    async def generate(
        self,
        prompt: str,
        priority: str = "realtime"
    ) -> str:
        bulkhead = self.bulkheads[priority]
        
        async with bulkhead.acquire():
            return await self._call_llm(prompt)
```

</div>

---

## استراتژی‌های انقضای زمان (Timeout Strategies)

### تایم‌اوت‌های لایه‌ای

<div dir="ltr">

```python
class TimeoutConfig:
    def __init__(
        self,
        connection_timeout: float = 5.0,
        first_token_timeout: float = 15.0,  # set per model and effort level
        read_timeout: float = 30.0,
        total_timeout: float = 60.0
    ):
        self.connection_timeout = connection_timeout
        self.first_token_timeout = first_token_timeout
        self.read_timeout = read_timeout
        self.total_timeout = total_timeout


class TimeoutManager:
    def __init__(self, config: TimeoutConfig):
        self.config = config
    
    async def execute_with_timeout(self, func, *args, **kwargs):
        try:
            return await asyncio.wait_for(
                func(*args, **kwargs),
                timeout=self.config.total_timeout
            )
        except asyncio.TimeoutError:
            raise LLMTimeoutError(
                f"Request timed out after {self.config.total_timeout}s"
            )
```

</div>

**زمان رسیدن به اولین توکن (TTFT) تایم‌اوت مستقل خود را دارد:** در جریان‌های استریمینگ، مهلت اولین توکن چیزی است که برای تغییر مسیر اضطراری اهمیت دارد: پیش از اولین توکن می‌توانید تمیز به بک‌اند دیگر سوئیچ کنید، پس از آن باید از ابتدا بازپخش نمایید یا خطا را نمایش دهید. درگاه‌های استنتاج اکنون این قابلیت را به‌طور مستقیم ارائه می‌دهند (مانند `streamIdleTimeout` در Envoy AI Gateway 1.1). آن را به ازای هر مدل و سطح تلاش استدلال تنظیم کنید: یک درخواست استدلال سطح بالا می‌تواند برای مدتی طولانی هیچ خروجی مشهودی ارسال نکند.

### تایم‌اوت‌های تطبیقی (Adaptive Timeouts)

<div dir="ltr">

```python
class AdaptiveTimeout:
    """
    Adjust timeouts based on observed latency.
    """
    
    def __init__(
        self,
        initial_timeout: float = 30.0,
        min_timeout: float = 10.0,
        max_timeout: float = 120.0,
        percentile: float = 0.99
    ):
        self.min_timeout = min_timeout
        self.max_timeout = max_timeout
        self.percentile = percentile
        self.latencies: list[float] = []
        self.current_timeout = initial_timeout
    
    def record_latency(self, latency: float):
        self.latencies.append(latency)
        
        # Keep last 1000 observations
        if len(self.latencies) > 1000:
            self.latencies = self.latencies[-1000:]
        
        # Update timeout to percentile + buffer
        if len(self.latencies) >= 10:
            sorted_latencies = sorted(self.latencies)
            idx = int(len(sorted_latencies) * self.percentile)
            p99_latency = sorted_latencies[idx]
            
            # Add 20% buffer
            new_timeout = p99_latency * 1.2
            self.current_timeout = max(
                self.min_timeout,
                min(self.max_timeout, new_timeout)
            )
    
    def get_timeout(self) -> float:
        return self.current_timeout
```

</div>

---

## کاهش تدریجی سطح خدمت (Graceful Degradation)

### سطوح تنزل خدمت

<div dir="ltr">

```python
class DegradationLevel(Enum):
    FULL = "full"           # All features
    REDUCED = "reduced"     # Fewer features
    MINIMAL = "minimal"     # Core only
    CACHED = "cached"       # Cached responses only
    OFFLINE = "offline"     # Error message

class GracefulDegrader:
    def __init__(self):
        self.current_level = DegradationLevel.FULL
        self.health_checker = HealthChecker()
    
    async def get_response(self, query: str) -> str:
        level = await self.health_checker.get_degradation_level()
        
        if level == DegradationLevel.FULL:
            return await self.full_pipeline(query)
        
        elif level == DegradationLevel.REDUCED:
            # Skip expensive operations
            return await self.reduced_pipeline(query)
        
        elif level == DegradationLevel.MINIMAL:
            # Simpler model, no retrieval
            return await self.minimal_pipeline(query)
        
        elif level == DegradationLevel.CACHED:
            # Only return cached responses
            cached = await self.cache.get_similar(query)
            if cached:
                return cached
            return "I'm experiencing issues. Please try again later."
        
        else:
            return "Service temporarily unavailable."
    
    async def full_pipeline(self, query: str) -> str:
        # RAG + primary model + ensemble verification
        context = await self.retrieve(query)
        response = await self.generate(query, context, model="gpt-6.1-sol")
        verified = await self.verify(response)
        return verified
    
    async def reduced_pipeline(self, query: str) -> str:
        # RAG + smaller model, no verification
        context = await self.retrieve(query)
        return await self.generate(query, context, model="gpt-6-luna")
    
    async def minimal_pipeline(self, query: str) -> str:
        # Direct generation with smallest model, no retrieval
        return await self.generate(query, None, model="gpt-6-luna")
```

</div>

---

## تغییر مسیر اضطراری میان چند ارائه‌دهنده (Multi-Provider Failover)

**تغییر مسیر اضطراری را میان ارائه‌دهندگان مختلف تنظیم کنید، نه میان مدل‌های هم‌خانواده:** قطعی‌ها کل سطح خدمات یک ارائه‌دهنده را همزمان از کار می‌اندازند. فید وضعیت Anthropic حداقل ۱۲ حادثه بزرگ یا بحرانی را بین ۱۶ آگوست تا ۲۹ سپتامبر ۲۰۲۶ ثبت کرده که چندین مورد آن API، ابزار Claude Code و claude.ai را همزمان مختل کردند. حادثه ۲۹ سپتامبر OpenAI کل API، ChatGPT و Codex را برای بیش از ۵ ساعت دچار اختلال کرد. ابرها نیز دچار قطعی می‌شوند: حادثه منطقه us-west1 گوگل کلود در ۲۰ آگوست بیش از ۲ ساعت اختلال برای مشتریان داشت. زنجیره‌ای که فقط به یک مدل دیگر در همان ارائه‌دهنده سوئیچ کند، از هیچ‌یک از این حوادث نجات نمی‌یابد.

**تغییر مسیر اضطراری یک تعویض ساده و مستقیم نیست:** مسیر فال‌بک باید درخواست را بپذیرد، مکالمه را حفظ کند، شرایط داده‌ای یکسانی را برآورده سازد، و کار را به درستی انجام دهد:

| بخش آسیب‌پذیر | نمونه واقعی (نوامبر ۲۰۲۶) | راهکار اصلاحی |
|---|---|---|
| ساختار درخواست (Request shape) | مدل‌های Claude Fable 5.1، Opus 5.5 و Sonnet 5.5 روی `tool_choice` اجباری خطای 400 می‌دهند؛ نسخه API کلود `2026-10-21` پارامترهای `temperature`، `top_p` و `top_k` را در هر مقداری رد می‌کند؛ مدل GPT-6 Astra پارامترهای سفارشی دما و `logprobs` را نمی‌پذیرد | تبدیل و ترجمه پارامترها به ازای هر مقصد از روی پروفایل قابلیت‌ها؛ هرگز پارامترها را کورکورانه عبور ندهید |
| وضعیت مکالمه (Conversation state) | جدیدترین مدل‌های Claude بلوک‌های تفکر را به مدل و مکالمه مقید می‌کنند | تغییر مسیر اضطراری را در مرز نوبت‌های مکالمه انجام دهید؛ متن مشهود و نتایج ابزار را ارسال کنید |
| شرایط نگهداری داده (Data terms) | مدل Fable 5.1 نیازمند ۳۰ روز نگهداری داده است مگر مجوز ZDR داشته باشد؛ نسخه بتای Agents API شرکت OpenAI فاقد ZDR است | شرایط نگهداری و اقامتگاه داده را به ازای هر مدل در رجیستری ثبت کرده و در زمان روتینگ اعمال کنید |
| کیفیت خروجی (Output quality) | مدل جایگزین هرگز روی تسک شما ارزیابی نشده است | سوییت ارزیابی را بر اساس یک زمان‌بندی منظم روی تمام مسیرهای بازگشت اجرا کنید |

### مدیریت ارائه‌دهندگان (Provider Manager)

<div dir="ltr">

```python
class ProviderManager:
    def __init__(self):
        self.providers = {
            "primary": OpenAIProvider(),
            "secondary": AnthropicProvider(),
            "tertiary": GoogleProvider()
        }
        self.health = {name: True for name in self.providers}
        self.priority_order = ["primary", "secondary", "tertiary"]
    
    async def generate(self, request: dict) -> str:
        for provider_name in self.priority_order:
            if not self.health[provider_name]:
                continue
            
            provider = self.providers[provider_name]
            
            try:
                result = await provider.generate(request)
                return result
            except RetryableError as e:
                # Mark unhealthy but continue to next provider
                self.health[provider_name] = False
                asyncio.create_task(
                    self._health_check_later(provider_name)
                )
                continue
        
        raise AllProvidersUnavailableError()
    
    async def _health_check_later(self, provider_name: str):
        await asyncio.sleep(30)  # Wait before retrying
        try:
            await self.providers[provider_name].health_check()
            self.health[provider_name] = True
        except:
            # Schedule another check
            asyncio.create_task(self._health_check_later(provider_name))
```

</div>

### پوشش ریسک درخواست (Request Hedging)

<div dir="ltr">

```python
class HedgedRequest:
    """
    Start the primary; if it is slow or fails, race the other providers
    against it and keep the first successful response.
    """
    
    def __init__(self, providers: list, hedge_delay: float = 2.0):
        self.providers = providers
        self.hedge_delay = hedge_delay
    
    async def generate(self, request: dict) -> str:
        primary = asyncio.create_task(self.providers[0].generate(request))
        
        # asyncio.wait, unlike wait_for, does not cancel the primary on timeout
        done, _ = await asyncio.wait({primary}, timeout=self.hedge_delay)
        if primary in done and primary.exception() is None:
            return primary.result()
        
        # Primary is slow or failed: hedge to the others, keeping a slow primary in the race
        pending = set() if primary in done else {primary}
        pending |= {
            asyncio.create_task(provider.generate(request))
            for provider in self.providers[1:]
        }
        
        try:
            while pending:
                done, pending = await asyncio.wait(
                    pending, return_when=asyncio.FIRST_COMPLETED
                )
                for task in done:
                    if task.exception() is None:
                        return task.result()  # first success wins, not first finisher
            raise AllProvidersFailedError()
        finally:
            for task in pending:
                task.cancel()  # stop paying for the losers
```

</div>

پوشش ریسک را تنها برای درخواست‌های خنثی‌اثر (Idempotent - بدون فراخوانی ابزارهای با اثر جانبی) به کار بگیرید، مقدار `hedge_delay` را نزدیک به تاخیر صدک ۹۵ ارائه‌دهنده اصلی تنظیم کنید، و برای آن بودجه لحاظ نمایید: یک درخواست پوشش‌داده‌شده هزینه بازوهای بازنده را نیز پرداخت می‌کند (حداقل توکن‌های ورودی آنها را).

---

## پرسش‌های مصاحبه (Interview Questions)

### پرسش: چگونه برای دسترسی‌پذیری بالا (High Availability) در سیستم‌های LLM طراحی انجام می‌دهید؟

**پاسخ قوی:**
من از لایه‌های متعددی از راهکارهای پایایی استفاده می‌کنم:

**تلاش مجدد با عقب‌نشینی (Retry with backoff):** عقب‌نشینی نمایی با نوسان تصادفی (Jitter) برای خطاهای گذرا، با رعایت کامل هدر `Retry-After`. تفکیک دقیق خطاهای قابل تکرار (بیشتر خطاهای محدودیت نرخ، اضافه بار، تایم‌اوت) از خطاهای غیرقابل تکرار (احراز هویت، خطای درخواست کلاینت) امری حیاتی است؛ و همچنین انشعاب بر اساس کد تفصیلی خطا: خطای 429 سقف بودجه شبیه محدودیت نرخ است اما نیازمند انتقال فوری به ارائه‌دهنده دیگر و مداخله انسانی است، نه صرفاً عقب‌نشینی زمانی.

**قطع‌کننده مدار (Circuit breaker):** اگر یک ارائه‌دهنده مکرراً با شکست مواجه شود، تلاش را برای یک دوره خنک‌سازی مشخص متوقف می‌کنم. این کار از اتلاف تاخیر روی ارائه‌دهنده از کار افتاده جلوگیری کرده و به آن زمان بازیابی می‌دهد.

**تغییر مسیر اضطراری میان چند ارائه‌دهنده (Multi-provider failover):** هرگز به یک ارائه‌دهنده منفرد وابسته نمی‌شوم. ارائه‌دهندگان اصلی، ثانویه و ثالث را در میان شرکت‌های مختلف پیکربندی می‌کنم، زیرا قطعی یک ارائه‌دهنده معمولاً تمام مدل‌های آن را از کار می‌اندازد. هر ارائه‌دهنده مدارشکن مختص به خود را دارد و تمام بازوهای فال‌بک از قبل ارزیابی کیفی شده‌اند.

**مدیریت امتناع‌های ایمنی:** امتناع‌های ایمنی در جدیدترین مدل‌های Claude به عنوان پاسخ HTTP 200 با `stop_reason: "refusal"` بازمی‌گردند؛ بنابراین آنها را به مدل جایگزین تاییدشده هدایت می‌کنم نه اینکه خطا یا موفقیت تلقی نمایم.

**کاهش تدریجی سطح خدمت (Graceful degradation):** تعریف آنچه در زمان در دسترس نبودن هیچ ارائه‌دهنده‌ای رخ می‌دهد. بازگرداندن پاسخ تقلیل‌یافته (مدل ساده‌تر، نتایج کش‌شده) بسیار بهتر از شکست کامل سیستم است.

**جداسازی منابع (Bulkheading):** ایزوله‌سازی بارهای کاری مختلف. هجوم بارهای کاری دسته‌ای (Batch) نباید کوئری‌های بلادرنگ کاربران را با اختلال مواجه کند.

بینش کلیدی: فرض را بر وقوع قطعی بگذارید. APIهای LLM بسیار ناپایدارتر از سرویس‌های سنتی هستند؛ بنابراین طوری طراحی کنید که گویی ارائه‌دهنده قطع خواهد شد.

### پرسش: تفاوت میان قطع‌کننده مدار (Circuit Breaker) و تلاش مجدد (Retry) چیست؟

**پاسخ قوی:**
آنها مسائل متفاوتی را حل می‌کنند:

**تلاش مجدد (Retry)** خطاهای گذرا و موقت را مدیریت می‌کند. اگر یک درخواست منفرد با شکست مواجه شد، دوباره تلاش می‌کند. این فرض را دارد که شکست‌ها مستقل هستند و تلاش بعدی ممکن است موفق شود.

**قطع‌کننده مدار (Circuit breaker)** خطاهای سیستمی و فراگیر را مدیریت می‌کند. اگر درخواست‌های زیادی پی‌درپی شکست بخورند، ارسال درخواست را کاملاً متوقف می‌سازد. این فرض را دارد که سیستم پایینی ناسالم است و تکرار درخواست‌ها منابع را هدر داده و روند بازیابی را کند می‌کند.

**نحوه همکاری آنها:**
۱. درخواست شکست می‌خورد ← تلاش مجدد با عقب‌نشینی (تلاش‌های ۱، ۲ و ۳)
۲. اگر تمام تلاش‌ها شکست بخورند ← مدارشکن شکست را ثبت می‌کند
۳. پس از N شکست متوالی ← مدار باز می‌شود و درخواست‌ها را فوراً رد می‌کند
۴. پس از انقضای تایم‌اوت ← مدار نیمه‌باز می‌شود و تعداد محدودی درخواست آزمایشی عبور می‌دهد
۵. اگر آزمون‌ها موفق شوند ← مدار بسته می‌شود و عملیات عادی از سر گرفته می‌شود

بدون مدارشکن: در زمان قطعی ارائه‌دهنده، هر درخواست تمام زمان تلاش‌های مجدد را پیش از شکست سپری می‌کند، تاخیرها اوج می‌گیرند و منابع تهی می‌شوند.
با مدارشکن: پس از کشف قطعی، درخواست‌ها به سرعت شکست را اعلام می‌کنند (Fail fast)، سیستم پاسخگو می‌ماند و می‌تواند به سرعت ترافیک را به ارائه‌دهنده دیگر هدایت کند.

### پرسش: ارائه‌دهنده شما اصلاحیه‌ای را تحت همان شناسه مدل قبلی منتشر کرده و متریک‌های کیفی شما تغییر کرده‌اند. چگونه تغییرات خاموش مدل را کشف و مدیریت می‌کنید؟

**پاسخ قوی:**
من فرض را بر این می‌گذارم که مدل پشت یک شناسه می‌تواند تغییر کند، زیرا این اتفاق عملاً رخ می‌دهد. مدل‌های GPT-6 Sol و Luna در ۲۲ سپتامبر ۲۰۲۶ با یک باگ انکودینگ تصویر عرضه شدند؛ شرکت OpenAI در ۲۵ سپتامبر آن را تحت همان شناسه اصلاح کرد و به مشتریان ورودی تصویر گفت ارزیابی‌های خود را دوباره اجرا کنند.

**کشف و شناسایی:**
- اجرای یک سوییت ارزیابی قناری کوچک روی اندپوینت پروداکشن بر اساس زمان‌بندی منظم (مثلاً ساعتی برای مسیرهای حیاتی)، نه صرفاً در خط لوله CI.
- مانیتورینگ توزیع روی سیگنال‌های ارزان: طول خروجی، نرخ امتناع به تفکیک دسته، نرخ فراخوانی ابزارها، خطاهای اعتبارسنجی اسکیما، و نمرات داور روی نمونه‌ای از ترافیک واقعی.
- اتصال مستقیم گزارش تغییرات ارائه‌دهندگان و صفحات وضعیت آنها به همان کانال هشداری که استقرارهای داخلی خودمان به آن متصل است.

**مدیریت:**
- تثبیت اسنپ‌شات‌های تاریخ‌دار در صورت ارائه توسط ارائه‌دهنده.
- متوقف کردن مهاجرت نهایی تا اجرای دومین آزمون ارزیابی یک یا دو هفته پس از انتشار اولیه، و گرم نگه داشتن مدل قبلی تا زمان اثبات پایداری مدل جدید.
- زمانی که ارائه‌دهنده اصلاحیه‌ای را اعلام می‌کند، اجرای مجدد برش ارزیابی مربوطه و مقایسه آن با آخرین خط مبنای سالم پیش از اعتماد به اعداد جدید.

اصل اساسی: رفتار مدل یک وابستگی خارجی است که بدون تغییر نسخه جابه‌جا می‌شود، بنابراین نیازمند همان راستی‌آزمایی مستمری است که برای هر سرویس خارجی اعمال می‌گردد.

---

## مراجع (References)

- الگوهای تاب‌آوری معماری مایکروسافت: https://learn.microsoft.com/en-us/azure/architecture/patterns/
- لایبرری Hystrix نتفلیکس: https://github.com/Netflix/Hystrix
- گزارش تغییرات API شرکت OpenAI (خطای `slow_down` و خطای ۵۰۳ در ۲ سپتامبر ۲۰۲۶؛ اصلاح باگ انکودینگ تصویر در ۲۵ سپتامبر ۲۰۲۶): https://developers.openai.com/api/docs/changelog
- مستندات امتناع‌ها و بازگشت اضطراری در شرکت Anthropic: https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback
- مستندات محدودیت‌های نرخ در Anthropic: https://platform.claude.com/docs/en/api/rate-limits
- تاریخچه وضعیت خدمات Anthropic: https://status.claude.com/history

---

*قبلی: [روش‌های آنسامبل](02-ensemble-methods.md) · بعدی: [حاکمیت و انطباق هوش مصنوعی](04-ai-governance-and-compliance.md)*

</div>