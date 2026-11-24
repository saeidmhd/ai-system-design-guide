<div dir="rtl">

# خطوط لوله CI/CD برای برنامه‌های مبتنی بر LLM

استقرار برنامه‌های کاربردی LLM نیازمند تطبیق شیوه‌های سنتی CI/CD با دغدغه‌های ویژه هوش مصنوعی، مانند ارزیابی مدل، آزمون پرامپت و دروازه‌های کنترل کیفیت است.

## فهرست مطالب

- [چالش‌های CI/CD در سیستم‌های LLM](#llm-cicd-challenges)
- [معماری خط لوله (Pipeline Architecture)](#pipeline-architecture)
- [مراحل آزمون و تست](#testing-stages)
- [دروازه‌های کیفیت (Quality Gates)](#quality-gates)
- [استراتژی‌های استقرار](#deployment-strategies)
- [رویه و فرآیند بازگشت (Rollback)](#rollback-procedures)
- [پرسش‌های مصاحبه](#interview-questions)
- [منابع](#references)

---

## چالش‌های CI/CD در سیستم‌های LLM <a id="llm-cicd-challenges"></a>

### چه عواملی استقرارهای LLM را متمایز می‌سازد

| فرآیند سنتی CI/CD | فرآیند CI/CD در مدل‌های LLM |
|---|---|
| تست‌های دودویی (قبول / رد قطعی) | ارزیابی‌های احتمالی و آماری |
| تست‌های سریع و کم‌هزینه | ارزیابی‌های کند، محاسباتی و پرهزینه |
| خروجی‌های قطعی (Deterministic) | خروجی‌های غیرقطعی و متغیر |
| صرفاً تغییرات کدهای نرم‌افزاری | تغییرات همزمان در پرامپت + مدل + داده‌ها |
| مدیریت نسخه ساده و سرراست | نسخه‌بندی پیچیده پرامپت‌ها و وابستگی‌ها |

### انواع تغییرات در سیستم

| نوع تغییر | سطح ریسک | آزمون‌های الزامی |
|---|---|---|
| متن پرامپت | متوسط | ارزیابی رگرسیون + سنجش کیفیت |
| پرامپت سیستمی | بالا | اجرای کامل سوییت ارزیابی |
| نسخه مدل (شامل مهاجرت‌های اجباری) | بالا | بنچمارک جامع + تست‌های قرارداد API |
| ایندکس RAG | متوسط | ارزیابی بازیابی + سنجش کیفیت |
| پارامترها (میزان تلاش، تفکر، حداکثر توکن) | متوسط | نمونه‌گیری از کیفیت و هزینه‌ها |
| تغییر سمت ارائه‌دهنده با همان شناسه مدل | متوسط تا بالا | ارزیابی‌های دوره‌ای زمان‌بندی‌شده روی شناسه‌های پروداکشن |
| نسخه اصلی (Major) در SDK یا فریم‌ورک | متوسط | تست‌های قرارداد روی درخواستی که واقعاً ارسال می‌شود |
| پیکربندی Agent، ادیتور یا VCS در مخزن | بالا | بازبینی امنیتی؛ رفتار مشابه کد اجرایی |

چهار ردیف آخر مواردی هستند که در سال ۲۰۲۶ تبدیل به الزاماتی گریزناپذیر شدند. تنظیمات Agent و VCS در [مرحله ۵](#stage-5-supply-chain-and-agent-config-gates) بررسی شده‌اند؛ سه مورد دیگر عبارتند از:

- **پارامترهای سمپلینگ در مدل‌های Claude حذف شده‌اند.** طبق نسخه API مورخ `2026-10-21` شرکت Anthropic، ارسال هر یک از پارامترهای `temperature`، `top_p` یا `top_k` در تمام مدل‌های Claude خطای 400 برمی‌گرداند، حتی اگر مقادیر پیش‌فرض باشند؛ گوگل نیز این موارد را در ۲۱ ژوئیه در API جمینای منسوخ کرد و مدل GPT-6 Astra نیز دمای سفارشی را رد می‌کند. استراتژی قدیمی «تنظیم دما روی ۰ برای تست‌های تکرارپذیر CI» دیگر کارایی ندارد؛ درجه تلاش استدلال اهرم اصلی است و پیش‌فرض‌های آن میان نسخه‌ها متغیر است (مثلاً Opus 5.5 پیش‌فرض `medium` دارد). اعتبارسنجی‌ها باید بر روی فیلدهای ساختاریافته و بررسی‌های معنایی متمرکز شوند، نه تطابق عینی رشته‌ها.
- **رفتار مدل با شناسه ثابت ممکن است تغییر کند.** شرکت OpenAI در ۲۵ سپتامبر ۲۰۲۶ یک باگ انکودینگ تصویر را در `gpt-6-sol` و `gpt-6-luna` بدون تغییر شناسه مدل برطرف کرد؛ بنابراین ارزیابی‌های تصویری قبلی دیگر توصیف‌کننده رفتار اندپوینت نبودند. ابزارهای خط فرمان عاملی نیز مدل‌های پیش‌فرض را در آپدیت‌های جزئی تغییر می‌دهند (سوئیچ Codex CLI به GPT-6.1 Sol و Claude Code به Opus 5.5). همچنین از نسخه Claude Code 2.1.302، نشست‌های بدون واسط بدون تعیین صریح سطح دسترسی، در حالت پیش‌فرض `default` اجرا می‌شوند؛ بنابراین در CI باید سطح مجوز را صریح مشخص کرد. سوییت‌های ارزیابی را طبق زمان‌بندی منظم روی شناسه‌های دقیق پروداکشن اجرا کنید، نه صرفاً در زمان کامیت کدها.
- **نسخه‌های اصلی SDK به صورت نامحسوس بستر آزمون را دچار اختلال می‌کنند.** کیت‌های رسمی Anthropic SDK 1.0 و OpenAI SDK 3.0 هر دو به کتابخانه `httpx2` مهاجرت کردند. در نتیجه ابزارهای OpenTelemetry، کتابخانه‌های ماک مانند `respx` و `vcrpy` ممکن است فراخوانی‌ها را نادیده بگیرند مگر آنکه متد `httpx2.alias_httpx()` فراخوانی شود؛ بنابراین تست‌ها ممکن است همچنان پاس شوند در حالی که عملاً ترافیک واقعی به سرور ارسال کرده یا تله‌متری ثبت نکرده‌اند. همچنین نسخه‌های اصلی جدید Anthropic به مجوز Apache 2.0 تغییر یافته‌اند که باید در اسکنرهای لایسنس بازبینی شود.

---

## معماری خط لوله (Pipeline Architecture) <a id="pipeline-architecture"></a>

### خط لوله کامل

<div dir="ltr">

```
┌─────────────────────────────────────────────────────────────────┐
│                       LLM CI/CD PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │   Commit     │                                               │
│  │   Trigger    │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │   Validate   │ ─── Prompt syntax, config validation         │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Unit Tests   │ ─── Fast, deterministic tests                │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │  Golden Set  │ ─── Known input/output pairs                 │
│  │    Tests     │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │   LLM Eval   │ ─── Quality scoring, regression detection    │
│  │   (Sampled)  │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │ Quality Gate │ ─── Pass/fail based on thresholds            │
│  └──────┬───────┘                                               │
│         │                                                        │
│    ┌────┴────┐                                                  │
│    ▼         ▼                                                  │
│ ┌──────┐ ┌───────┐                                             │
│ │Canary│ │Blocked│                                             │
│ │Deploy│ │       │                                             │
│ └──┬───┘ └───────┘                                             │
│    │                                                            │
│    ▼                                                            │
│ ┌──────────────┐                                               │
│ │  Production  │                                               │
│ │  Monitoring  │                                               │
│ └──────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

</div>

---

## مراحل آزمون و تست <a id="testing-stages"></a>

### مرحله ۱: اعتبارسنجی ایستا (Static Validation)

<div dir="ltr">

```python
class PromptValidator:
    def validate(self, prompt_config: dict) -> ValidationResult:
        errors = []
        
        # Required fields
        if not prompt_config.get("system_prompt"):
            errors.append("Missing system_prompt")
        
        # Template syntax
        try:
            Template(prompt_config["user_template"]).substitute({})
        except KeyError:
            pass  # Expected for templates with variables
        except ValueError as e:
            errors.append(f"Invalid template syntax: {e}")
        
        # Token limits
        system_tokens = count_tokens(prompt_config.get("system_prompt", ""))
        if system_tokens > 4000:
            errors.append(f"System prompt too long: {system_tokens} tokens")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors
        )
```

</div>

### مرحله ۲: آزمون‌های واحد (Unit Tests)

<div dir="ltr">

```python
class PromptUnitTests:
    def test_template_rendering(self):
        prompt = PromptTemplate(SYSTEM_PROMPT, USER_TEMPLATE)
        
        rendered = prompt.render(
            query="test query",
            context="test context"
        )
        
        assert "test query" in rendered
        assert "test context" in rendered
        assert len(rendered) < 10000  # Token limit
    
    def test_output_parsing(self):
        parser = OutputParser()
        
        valid_output = '{"answer": "test", "confidence": 0.9}'
        result = parser.parse(valid_output)
        assert result["answer"] == "test"
        
        invalid_output = "not json"
        with pytest.raises(ParseError):
            parser.parse(invalid_output)
```

</div>

### مرحله ۳: آزمون‌های مجموعه طلایی (Golden Set Tests)

<div dir="ltr">

```python
class GoldenSetRunner:
    def __init__(self, golden_set: list[dict]):
        self.golden_set = golden_set
    
    async def run(self, llm_client) -> TestResults:
        results = []
        
        for example in self.golden_set:
            response = await llm_client.generate(example["input"])
            
            # Exact match for deterministic outputs
            if example.get("exact_match"):
                passed = response == example["expected"]
            # Contains check for flexible outputs
            elif example.get("must_contain"):
                passed = all(
                    phrase in response 
                    for phrase in example["must_contain"]
                )
            # LLM judge for quality
            else:
                passed = await self.judge_quality(
                    response, example["expected"]
                )
            
            results.append(TestResult(
                input=example["input"],
                expected=example["expected"],
                actual=response,
                passed=passed
            ))
        
        return TestResults(
            total=len(results),
            passed=sum(1 for r in results if r.passed),
            failed=[r for r in results if not r.passed]
        )
```

</div>

### مرحله ۴: ارزیابی با مدل زبان بزرگ (LLM Evaluation)

<div dir="ltr">

```python
class LLMEvaluationStage:
    def __init__(self, eval_set: list[dict], sample_rate: float = 0.1):
        self.eval_set = eval_set
        self.sample_rate = sample_rate
        self.evaluator = LLMEvaluator()
    
    async def run(self, llm_client) -> EvalResults:
        # Sample for cost efficiency
        sample = random.sample(
            self.eval_set,
            int(len(self.eval_set) * self.sample_rate)
        )
        
        scores = []
        for example in sample:
            response = await llm_client.generate(example["input"])
            
            score = await self.evaluator.evaluate(
                query=example["input"],
                response=response,
                reference=example.get("reference"),
                criteria=["relevance", "accuracy", "helpfulness"]
            )
            scores.append(score)
        
        return EvalResults(
            sample_size=len(sample),
            avg_relevance=np.mean([s["relevance"] for s in scores]),
            avg_accuracy=np.mean([s["accuracy"] for s in scores]),
            avg_helpfulness=np.mean([s["helpfulness"] for s in scores])
        )
```

</div>

مجموعه ابزار ارزیابی را مستقل و قابل حمل نگه دارید. سرویس‌های ارزیابی میزبانی‌شده نیز دستخوش تغییر می‌شوند: پلتفرم OpenAI Evals در ۳۰ نوامبر ۲۰۲۶ خاموش می‌شود و کاربران به ابزار Promptfoo هدایت شده‌اند که تحت نظارت OpenAI و با مجوز MIT به کار خود ادامه می‌دهد. دیتاست‌ها، سنجه‌ها و آستانه‌های قبولی را در فرمت‌های مستقل از ابزار درون مخزن اختصاصی خود ذخیره کنید تا این دروازه با تغییر سرویس‌ها پایدار بماند. نمونه کامل این ساختار در [مطالعه موردی CI/CD مبتنی بر ارزیابی](../16-case-studies/18-eval-gated-cicd.md) آمده است.

### مرحله ۵: دروازه‌های امنیتی زنجیره تأمین و پیکربندی عاملی <a id="stage-5-supply-chain-and-agent-config-gates"></a>

مخازن پروژه‌های هوش مصنوعی امروزه حاوی پیکربندی‌های اجرایی هستند که بازبینی‌های کد سنتی معمولاً به‌سادگی از کنار آن‌ها عبور می‌کنند، در حالی که مهاجمان دقیقاً آن‌ها را هدف می‌گیرند:

| بخش تحت تأثیر | حادثه در سال ۲۰۲۶ | دروازه کنترلی (Gate) |
|---|---|---|
| پیکربندی اجرای خودکار در Agent و ادیتور (هوک‌های `.claude/settings.json`، تسک‌های باز کردن فولدر در `.vscode/tasks.json`) | بدافزار Mini Shai-Hulud از این هوک‌ها بهره برد؛ کرم نرم‌افزاری ChainDrop در npm (۴ اوت) از آن‌ها در ۴۴۴ پکیج برای سرقت توکن‌های OpenAI، Anthropic، Cursor و Codex استفاده کرد | بازبینی از طریق CODEOWNERS روی این مسیرها؛ شکست بیلد CI در صورت مشاهده تسک یا هوک جدید |
| فایل `.git/config` مخزن (گزینه‌های `core.fsmonitor`، `core.hooksPath`، فیلترها) | آسیب‌پذیری GitSpawn (مؤسسه Manifold، ۲ سپتامبر): هفت عامل کدنویسی CLI دستورات مهاجم را در فرآیندهای پس‌زمینه گیت اجرا کردند | اجرای گیت آغازشده توسط عامل با پرچم `-c core.fsmonitor=false`؛ عدم اعتماد به پوشه `.git` دریافتی خارج از کلون |
| پلاگین‌های قفل‌شده با هش SHA در عامل‌ها | آسیب‌پذیری Plugin4Shell (مؤسسه AIR Security، ۱۷ سپتامبر): ساخت شاخه‌ای همنام با هش SHA کد تأییدشده را جابه‌جا کرد؛ در نسخه Claude Code 2.1.179 و Codex 0.146.0 برطرف شد | بررسی مطابقت درخت کد واکشی‌شده با هش قفل‌شده پس از مرحله Checkout |
| وابستگی‌های دارای اصلاحیه بی‌صدا در بالادست | حادثه Hacktron (افشا در ۱۳ سپتامبر): در اواخر ژوئیه، مدل Claude Opus 5 یک خطای سرریز libheif را که بدون CVE اصلاح شده بود ظرف ۳ ساعت به یک اکسپلویت کاربردی تبدیل کرد | اعمال پچ بر مبنای اصلاحیه‌های بالادست نه صرفاً اعلامیه‌های CVE؛ بازسازی دوره‌ای ایمیج‌های پایه |

پنجره زمانی سوءاستفاده اکنون به چند ساعت تقلیل یافته است. پیامد این موضوع برای CI: بررسی تازگی وابستگی‌ها و ایمیج‌های پایه به یک دروازه الزامی با مهلت مشخص تبدیل می‌شود، و فایل‌های پیکربندی عامل‌ها باید مانند کد اجرایی بازبینی شوند.

همچنین تعیین کنید چه کسانی مجاز به تأیید این مسیرها هستند. از ۲۸ اکتبر ۲۰۲۶ تأییدیه‌های بازبینی کد با Copilot به عرضه عمومی رسیده است؛ با این حال، فایل‌های پیکربندی Agent، گردش‌کارهای CI و مانیفست‌های وابستگی را از تأیید خودکار هوش مصنوعی مستثنی کرده و تأیید انسانی از طریق CODEOWNER را برای آن‌ها الزامی سازید، زیرا این فایل‌ها دقیقاً اهدافی هستند که یک عامل نفوذیافته مایل به دستکاری آن‌هاست. جزئیات بیشتر در فصل [امنیت و ایزوله‌سازی عامل‌ها](../07-agentic-systems/09-agentic-security-and-sandboxing.md) ارائه شده است.

---

## دروازه‌های کیفیت (Quality Gates) <a id="quality-gates"></a>

### پیکربندی دروازه ارزیابی

<div dir="ltr">

```python
class QualityGate:
    def __init__(self, thresholds: dict):
        self.thresholds = thresholds
    
    def evaluate(self, results: dict) -> GateResult:
        failures = []
        
        # Golden set pass rate
        if results["golden_pass_rate"] < self.thresholds["golden_pass_rate"]:
            failures.append({
                "metric": "golden_pass_rate",
                "actual": results["golden_pass_rate"],
                "threshold": self.thresholds["golden_pass_rate"]
            })
        
        # Quality scores
        for metric in ["relevance", "accuracy", "helpfulness"]:
            if results.get(f"avg_{metric}", 0) < self.thresholds.get(metric, 0):
                failures.append({
                    "metric": metric,
                    "actual": results.get(f"avg_{metric}"),
                    "threshold": self.thresholds[metric]
                })
        
        # Regression detection
        if results.get("regression_detected"):
            failures.append({
                "metric": "regression",
                "details": results["regression_details"]
            })
        
        return GateResult(
            passed=len(failures) == 0,
            failures=failures
        )

# Example thresholds
QUALITY_THRESHOLDS = {
    "golden_pass_rate": 0.95,  # 95% of golden tests must pass
    "relevance": 4.0,          # Average score >= 4.0/5.0
    "accuracy": 4.0,
    "helpfulness": 3.5
}
```

</div>

---

## استراتژی‌های استقرار <a id="deployment-strategies"></a>

### استقرار قناری (Canary Deployment)

<div dir="ltr">

```python
class CanaryDeployer:
    def __init__(
        self,
        initial_percentage: int = 5,
        increment: int = 10,
        bake_time_minutes: int = 30
    ):
        self.initial_percentage = initial_percentage
        self.increment = increment
        self.bake_time = bake_time_minutes
    
    async def deploy(self, new_version: str):
        # Start canary
        await self.router.set_canary(new_version, self.initial_percentage)
        
        percentage = self.initial_percentage
        while percentage < 100:
            # Wait for bake time
            await asyncio.sleep(self.bake_time * 60)
            
            # Check canary health
            metrics = await self.get_canary_metrics(new_version)
            
            if not self.is_healthy(metrics):
                await self.rollback(new_version)
                raise CanaryFailedError(metrics)
            
            # Increment traffic
            percentage = min(100, percentage + self.increment)
            await self.router.set_canary(new_version, percentage)
        
        # Full rollout
        await self.router.promote_canary(new_version)
```

</div>

### استقرار سایه (Shadow Deployment)

<div dir="ltr">

```python
class ShadowDeployer:
    async def shadow_test(
        self,
        new_version: str,
        duration_hours: int = 24
    ):
        # Run new version in shadow mode
        await self.enable_shadow(new_version)
        
        # Collect comparison data
        start = datetime.now()
        while datetime.now() - start < timedelta(hours=duration_hours):
            await asyncio.sleep(60)
            
            comparison = await self.compare_outputs()
            if comparison["divergence_rate"] > 0.1:
                await self.alert("High divergence in shadow test", comparison)
        
        # Analyze results
        return await self.generate_comparison_report(new_version)
```

</div>

### مهاجرت میان مدل‌ها همان فرآیند استقرار است

تغییرات مدل‌ها اکنون بر اساس تقویم تأمین‌کننده اعمال می‌شوند نه زمان‌بندی داخلی شما. مدل Claude Sonnet 4.5 در ۳۰ نوامبر ۲۰۲۶ در API مستقیم کلود بازنشسته می‌شود در حالی که در Bedrock تا آوریل ۲۰۲۷ فعال است؛ اوپن‌ای‌آی اسنپ‌شات‌های قدیمی را در دسامبر ۲۰۲۶ و اسنپ‌شات‌های GPT-4o و مدل‌های فاین‌تیون آن‌ها را در ژانویه ۲۰۲۷ خاموش می‌کند. بر حداقل مهلت‌های رسمی تکیه نکنید، زیرا سوابق نشان داده گاهی مهلت‌ها به مراتب کوتاه‌تر هستند.

مدل‌های جدید قرارداد ارتباطی API را نیز دستخوش تغییر می‌کنند؛ بنابراین یک مهاجرت ممکن است پیش از سنجش کیفیت، در همان لایه فرمت درخواست با شکست مواجه شود:
- مدل‌های Claude Fable 5.1، Opus 5.5 و Sonnet 5.5 در صورت ارسال `tool_choice` از نوع `any` یا `tool` خطای 400 برمی‌گردانند؛ باید از `auto` همراه با خروجی‌های ساختاریافته استفاده شود.
- بخش تفکر (Thinking) در Opus 5.5 قابل غیرفعال‌سازی نیست، و در Sonnet 5.5 ارسال `thinking: {"type": "disabled"}` خطای 400 تولید می‌کند.
- بلوک‌های تفکر به مدل و زمینه مکالمه گره خورده‌اند: بلوک‌هایی که مدل دیگر قادر به خواندن آن‌ها نباشد بی‌صدا حذف می‌شوند، و ویرایش تاریخچه قبل از یک بلوک تفکر در حساب‌های جدید خطای 400 ایجاد می‌کند؛ بنابراین بازپخش متن مکالمات مدل قدیمی تست معتبری برای مدل جدید نیست.
- مدل GPT-6 Astra پارامترهای دما و لاگ‌پراپ را حذف کرده و برای ابزارها نیازمند Responses API است.

با ارتقای مدل دقیقاً مانند استقرار یک کد جدید رفتار کنید: سوییت ارزیابی را اجرا کنید، ساختار درخواست کلاینت را تست نمایید، آن را با ترافیک سایه بسنجید و سپس با استراتژی قناری و معیارهای رول‌بک مستقر سازید. مدل قبلی را تا زمان خاموشی رسمی به‌عنوان مقصد رول‌بک فعال نگه دارید.

---

## رویه و فرآیند بازگشت (Rollback) <a id="rollback-procedures"></a>

### بازگشت خودکار به نسخه قبل (Automated Rollback)

<div dir="ltr">

```python
class AutoRollback:
    def __init__(self, rollback_thresholds: dict):
        self.thresholds = rollback_thresholds
    
    async def monitor_and_rollback(self, version: str):
        while True:
            metrics = await self.get_live_metrics(version)
            
            # Check error rate
            if metrics["error_rate"] > self.thresholds["error_rate"]:
                await self.trigger_rollback(version, "error_rate_exceeded")
                return
            
            # Check latency
            if metrics["p99_latency"] > self.thresholds["p99_latency"]:
                await self.trigger_rollback(version, "latency_exceeded")
                return
            
            # Check quality (sampled)
            if metrics.get("quality_score", 5) < self.thresholds["quality_score"]:
                await self.trigger_rollback(version, "quality_degradation")
                return
            
            await asyncio.sleep(60)
    
    async def trigger_rollback(self, version: str, reason: str):
        previous = await self.get_previous_version()
        await self.router.rollback_to(previous)
        await self.alert(f"Auto-rollback from {version}: {reason}")
```

</div>

---

## پرسش‌های مصاحبه <a id="interview-questions"></a>

### پرسش: چگونه تغییرات پرامپت را پیش از استقرار در پروداکشن آزمایش می‌کنید؟

**پاسخ قوی:**
من از یک پایپ‌لاین آزمون چندمرحله‌ای استفاده می‌کنم:

**مرحله ۱: اعتبارسنجی ایستا.** بررسی نحو، سقف توکن‌ها و خطاهای قالب‌بندی. سریع و ارزان است.

**مرحله ۲: آزمون‌های واحد.** رندر قالب، پارس خروجی و رفتار قطعی توابع واسط.

**مرحله ۳: آزمون‌های مجموعه طلایی (Golden Set).** جفت‌های ورودی/خروجی مشخص که سیستم باید حتماً پاس کند تا پسرفت‌های آشکار شناسایی شوند.

**مرحله ۴: ارزیابی با مدل زبان بزرگ (LLM-as-judge).** ارزیابی نمونه‌برداری‌شده برای سنجش ابعاد کیفی (ارتباط با موضوع، دقت، مفید بودن). پرهزینه‌تر است اما خطاهای ظریف را شناسایی می‌کند.

**دروازه‌های کیفیت:** تمامی مراحل باید از آستانه‌های تعیین‌شده عبور کنند (بیش از ۹۵٪ قبولی در مجموعه طلایی، نمره کیفیت بالای ۴.۰ از ۵.۰).

**استقرار:** استقرار قناری با ۵٪ ترافیک، دوره نظارت ۳۰ دقیقه‌ای، بررسی سنجه‌ها و افزایش تدریجی سهم ترافیک.

نکته بنیادین این است که خروجی‌های LLM غیرقطعی هستند، بنابراین آزمون‌ها باید ماهیت آماری داشته باشند. ما نمی‌توانیم درستی ۱۰۰ درصدی را تضمین کنیم، اما تضمین می‌کنیم که کیفیت درون مرزهای مجاز باقی بماند.

### پرسش: چه محرک‌هایی باید باعث برگشت خودکار (Rollback) شوند؟

**پاسخ قوی:**
من چند محرک اصلی برای رول‌بک خودکار تنظیم می‌کنم:

**نرخ خطا:** اگر خطاها به مدت ۵ دقیقه متوالی از ۵٪ عبور کنند، رول‌بک اجرا می‌شود تا خرابی‌های سیستمی مهار شوند.

**میزان تأخیر:** اگر تأخیر صدک ۹۹ بیش از ۱۰ دقیقه از سقف تعهد خدمت (مثلاً ۱۰ ثانیه) تجاوز کند، بازگشت به نسخه قبل انجام می‌شود.

**امتیاز کیفی:** اگر نمره کیفی نمونه‌گیری‌شده به زیر ۳.۵ از ۵ افت کند، رول‌بک فعال می‌گردد تا از افت کیفی خاموش جلوگیری شود.

**سیگنال‌های کاربران:** اگر بازخوردهای منفی کاربران به ۲ برابر میانگین مبنا برسد، بررسی فوری و احتمال رول‌بک آغاز می‌شود.

**پیاده‌سازی:**
- هشدارهای Prometheus اسکریپت رول‌بک را تریگر می‌کنند
- اعلان خودکار به تیم مهندسی ارسال می‌شود
- بازگشت فوری به آخرین نسخه سالم شناخته‌شده صورت می‌گیرد
- استقرارهای بعدی تا زمان تکمیل بررسی مسدود می‌شوند

نکته کلیدی، سرعت در شناسایی و اقدام است. وجود یک پرامپت معیوب در پروداکشن به مدت ۱۰ دقیقه قابل اغماض است، اما ۱۰ ساعت غیرقابل پذیرش است.

### پرسش: ارائه‌دهنده شما مدلی را که محصولتان بر پایه آن اجرا می‌شود ظرف ۶۰ روز بازنشسته می‌کند. چگونه با اطمینان مهاجرت می‌کنید؟

**پاسخ قوی:**
من با این موضوع مانند یک استقرار از پیش برنامه‌ریزی‌شده با ضرب‌الاجل قطعی برخورد می‌کنم و آن را در چهار گام اجرا می‌نمایم:

**۱. بررسی قرارداد ارتباطی API در وهله نخست.** پیش از سنجش کیفیت، بررسی می‌کنم که درخواست‌ها همچنان معتبر باشند. مدل‌های جدید ممکن است ارسال اجباری ابزارها را رد کنند، غیرفعال‌سازی تفکر را نپذیرند، یا ارسال پارامترهای دما را با خطای 400 پاسخ دهند. من تست‌های قرارداد را روی ساختار واقعی درخواست کلاینت اجرا کرده و شکل آن را اصلاح می‌کنم.

**۲. ارزیابی جامع روی شناسه مدل جدید.** اجرای کامل مجموعه طلایی به‌همراه ارزیابی‌های نمونه‌برداری‌شده LLM، همراه با ثبت دقیق هزینه و تأخیر؛ زیرا تغییر رفتار پیش‌فرض تفکر می‌تواند صورت‌حساب را دگرگون کند. مکالمات ضبط‌شده روی مدل قبلی را بازپخش نمی‌کنم، زیرا مدل‌های جدید بلوک‌های تفکر مدل‌های دیگر را نمی‌پذیرند.

**۳. استقرار سایه و سپس قناری.** اجرای ترافیک واقعی به‌صورت سایه برای سنجش واگرایی نتایج، و سپس استقرار قناری با همان محرک‌های استاندارد رول‌بک. مدل قدیمی تا زمان خاموشی قطعی به‌عنوان مقصد بازگشت حفظ می‌شود.

**۴. اصلاح و استانداردسازی فرآیند.** ثبت تاریخ‌های بازنشستگی در یک رجیستری مرکزی به تفکیک جفت (مدل، پلتفرم)، و اجرای دوره‌ای آزمون‌های ارزیابی روی شناسه‌های پروداکشن تا تغییرات بی‌صدای ارائه‌دهنده نیز کشف شوند.

مهلت ۶۰ روزه کاملاً کافی است اگر پایپ‌لاین ارزیابی از قبل وجود داشته باشد؛ اما اگر قرار باشد سوییت ارزیابی در حین مهاجرت ساخته شود، زمان ناکافی خواهد بود.

---

## منابع <a id="references"></a>

- اصول و الگوهای MLOps: https://ml-ops.org/
- مستندات پلتفرم LangSmith: https://docs.smith.langchain.com/
- مستندات ابزار ارزیابی Promptfoo: https://www.promptfoo.dev/
- مستندات بازنشستگی‌های OpenAI: https://developers.openai.com/api/docs/deprecations
- مستندات تقویم بازنشستگی مدل‌های Anthropic: https://platform.claude.com/docs/en/about-claude/model-deprecations
- تحلیل StepSecurity پیرامون کرم نرم‌افزاری ChainDrop در npm: https://www.stepsecurity.io/blog/chaindrop-npm-worm
- تحلیل مؤسسه AIR Security پیرامون آسیب‌پذیری Plugin4Shell: https://www.air.security/blog-posts/plugin4shell

---

*مبحث قبلی: [زیرساخت‌های مدل‌های بزرگ زبانی](01-llm-infrastructure.md) · مبحث بعدی: [درگاه‌های هوش مصنوعی و مسیریابی مدل‌ها](03-ai-gateways-and-model-routing.md)*

</div>