<div dir="rtl">

# کنترل دسترسی برای سیستم‌های LLM (Access Control for LLM Systems)

کنترل دسترسی امن برای برنامه‌های کاربردی چندکاربره و چندمستاجره مبتنی بر مدل‌های بزرگ زبان (LLM) امری حیاتی است. این فصل الگوهای احراز هویت، مجوزدهی، و ایزوله‌سازی داده‌ها را پوشش می‌دهد.

## فهرست مطالب

- [الزامات کنترل دسترسی (Access Control Requirements)](#الزامات-کنترل-دسترسی-access-control-requirements)
- [الگوهای احراز هویت (Authentication Patterns)](#الگوهای-احراز-هویت-authentication-patterns)
- [مدل‌های مجوزدهی (Authorization Models)](#مدلهای-مجوزدهی-authorization-models)
- [مجوزدهی به ایجنت و ابزار (Agent and Tool Authorization)](#مجوزدهی-به-ایجنت-و-ابزار-agent-and-tool-authorization)
- [ایزوله‌سازی مستاجران (Tenant Isolation)](#ایزولهسازی-مستاجران-tenant-isolation)
- [مدیریت کلیدهای API (API Key Management)](#مدیریت-کلیدهای-api-api-key-management)
- [ممیزی و انطباق (Audit and Compliance)](#ممیزی-و-انطباق-audit-and-compliance)
- [پرسش‌های مصاحبه (Interview Questions)](#پرسشهای-مصاحبه-interview-questions)
- [مراجع (References)](#مراجع-references)

---

## الزامات کنترل دسترسی (Access Control Requirements)

### ابعاد امنیتی

| بعد امنیتی (Dimension) | شرح | ابزارهای کنترلی |
|---|---|---|
| **احراز هویت (Authentication)** | چه کسی درخواست می‌دهد؟ | کلیدهای API، پروتکل OAuth، توکن JWT، هویت بار کاری (Workload identity) |
| **مجوزدهی (Authorization)** | چه کارهایی مجاز است انجام دهد؟ | مدل‌های RBAC، مدل‌های ABAC، سیاست‌ها |
| **ایزوله‌سازی (Isolation)** | چه داده‌هایی را می‌تواند ببیند؟ | فیلتر کردن بر اساس مستاجر، رمزنگاری |
| **بازرسی و ممیزی (Audit)** | چه کارهایی انجام داده است؟ | لاگ‌گیری، گزارش‌های انطباق قانونی |

### دغدغه‌های خاص سیستم‌های LLM

| دغدغه امنیتی | ریسک | راهکار کاهش ریسک |
|---|---|---|
| تزریق پرامپت (Prompt injection) | دور زدن کنترل‌های دسترسی | اعتبارسنجی ورودی |
| نشت داده‌ها (Data leakage) | افشای اطلاعات میان مستاجران | فیلتر کردن دقیق و سخت‌گیرانه |
| خروجی مدل (Model output) | افشای اطلاعات حفاظت‌شده | فیلتر کردن خروجی |
| آلودگی کانتکست (Context pollution) | تزریق داده‌های غیرمجاز | اعتبارسنجی کانتکست |
| اعتبارات ایجنت (Agent credentials) | نشست ایجنت یا دستیار نفوذیافته از توکن‌های خود سوءاستفاده کند | توکن‌های کوتاه‌مدت، دارای دامنه محدود (Scoped)، و مقید به فرستنده (Sender-constrained) |
| نایب گیج‌شده در میان سرورهای ابزار (Confused deputy across tool servers) | یک سرور اعتبارات در نظر گرفته‌شده برای دیگری را هدایت کند | پیوند دادن هر اعتبار به صادرکننده و مخاطب آن |

---

## الگوهای احراز هویت (Authentication Patterns)

### احراز هویت با کلید API

<div dir="ltr">

```python
class APIKeyAuthenticator:
    def __init__(self, key_store):
        self.key_store = key_store
    
    async def authenticate(self, api_key: str) -> AuthResult:
        if not api_key:
            return AuthResult(authenticated=False, error="Missing API key")
        
        # Hash the key for lookup
        key_hash = self.hash_key(api_key)
        
        # Look up in store
        key_record = await self.key_store.get(key_hash)
        
        if not key_record:
            return AuthResult(authenticated=False, error="Invalid API key")
        
        if key_record.expired:
            return AuthResult(authenticated=False, error="Expired API key")
        
        if key_record.revoked:
            return AuthResult(authenticated=False, error="Revoked API key")
        
        return AuthResult(
            authenticated=True,
            user_id=key_record.user_id,
            tenant_id=key_record.tenant_id,
            scopes=key_record.scopes
        )
    
    def hash_key(self, key: str) -> str:
        return hashlib.sha256(key.encode()).hexdigest()
```

</div>

### توکن JWT همراه با دامنه‌های دسترسی (Scopes)

<div dir="ltr">

```python
class JWTAuthenticator:
    def __init__(self, public_key: str):
        self.public_key = public_key
    
    async def authenticate(self, token: str) -> AuthResult:
        try:
            payload = jwt.decode(
                token,
                self.public_key,
                algorithms=["RS256"],
                audience="llm-api"
            )
            
            return AuthResult(
                authenticated=True,
                user_id=payload["sub"],
                tenant_id=payload.get("tenant_id"),
                scopes=payload.get("scopes", []),
                expires_at=datetime.fromtimestamp(payload["exp"])
            )
        except jwt.ExpiredSignatureError:
            return AuthResult(authenticated=False, error="Token expired")
        except jwt.InvalidTokenError as e:
            return AuthResult(authenticated=False, error=str(e))
```

</div>

### هویت بار کاری (Workload Identity) به جای کلیدهای استاتیک

کلیدهای استاتیک API ضعیف‌ترین حلقه در ناوگان ایجنت‌ها هستند و مهاجمان اکنون آنها را بر اساس نام شکار می‌کنند. کرم npm موسوم به ChainDrop (آگوست ۲۰۲۶) توکن‌های OpenAI، Anthropic، Cursor، Codex و Gemini را در کنار اعتبارات ابری و گیت‌هاب سرقت می‌کرد. شرکت Mandiant نفوذی را توصیف کرد که در آن مهاجم یک نشست زنده دستیار کدنویسی AI را در دست گرفت، دستیار یک پکیج از پیش مسموم‌شده را پیشنهاد داد، و توکن‌های مسروقه OAuth گیت‌هاب باعث انتشار کرم Shai-Hulud در حدود ۱۰۰ مخزن داخلی شدند. ارائه‌دهندگان متناسب با این موضوع حرکت کرده‌اند: شرکت OpenAI قابلیت احراز هویت متقابل TLS (mTLS) و فدراسیون هویت بار کاری با گواهی‌های X.509 را به مرحله GA رساند (۲۹ آگوست ۲۰۲۶)، انقضای کلیدهای API را با سقف طول عمر در سطح سازمان و پروژه اضافه کرد (۱۰ سپتامبر)، و به ادمین‌ها اجازه محدودسازی یا غیرفعال کردن ساخت کلید را داد (۱۵ سپتامبر).

**اعتبارات سرقت‌شده بر اساس ساعت صورت‌حساب می‌شوند:** گروه اطلاعات تهدیدات گوگل (GTIG) و Mandiant در ۳ نوامبر ۲۰۲۶ گزارش دادند که حوادث سرقت منابع LLMjacking که مدیریت کردند، در یک روز بیش از ۱۰۰,۰۰۰ دلار و در مجموع تا پیش از لغو دسترسی تا ۱ میلیون دلار هزینه کلاهبردارانه ایجاد کرده بود؛ یک عامل تهدید بیش از ۵۰۰,۰۰۰ فراخوانی API مدل‌های LLM را در کمتر از هشت ساعت از طریق یک سرویس بازفروش انجام داد و نزدیک به ۱ میلیون دلار هزینه توکن را به قربانی تحمیل کرد (گزارش ارائه‌دهنده). نقطه ورود مهاجمان هویت ابری سرقت‌شده بود (اعتبارات IAM، کلیدهای حساب کاربری سرویس، توکن‌های دسترسی شخصی گیت‌هاب، توکن‌های نشست)، نه باگی در مدل؛ و عادات مهاجمان قابل تشخیص بود: آنها کلیدها را با درخواست‌های `max_tokens=1` اعتبارسنجی می‌کردند، سرویس‌های LLM را که قربانی هرگز استفاده نکرده بود روشن می‌کردند، و اندپوینت‌های بی‌حفاظ `/api/create` در Ollama را پروب می‌کردند. این واقعیت سهمیه‌ها و سقف هزینه‌های به ازای هر کلید را به یک ابزار کنترلی امنیتی تبدیل می‌کند، نه صرفاً یک موضوع FinOps؛ و همچنین رخداد «فعال شدن سرویس LLM در حسابی که هرگز از آن استفاده نکرده است» را به هشداری تبدیل می‌سازد که حتماً باید متصل و فعال شود.

قواعدی که از این تجربیات حاصل می‌شوند:

- **هویت بار کاری را ترجیح دهید** (mTLS، توکن‌های فدرال کوتاه‌مدت) برای فراخوانی‌های سرویس به ارائه‌دهنده. در جاهایی که کلیدها باقی می‌مانند، برای هر کلید یک مالک، تاریخ انقضا و سقف هزینه تعیین کنید.
- **با یک نشست ایجنت یا دستیار هوش مصنوعی به عنوان یک ماهیت هویتی مستقل (Principal) رفتار کنید** که اعتبارات محدودشده و مانیتورینگ اختصاصی خود را دارد، و کلیدهای خام API و توکن‌های بلندمدت OAuth را دور از دسترس آن نگه دارید.
- **از توکن‌های مقید به فرستنده (Sender-constrained tokens)** در جاهایی که پروتکل از آنها پشتیبانی می‌کند استفاده کنید (مانند DPoP تحت استاندارد RFC 9449)، تا یک توکن Bearer سرقت‌شده به تنهایی برای سوءاستفاده کافی نباشد.

---

## مدل‌های مجوزدهی (Authorization Models)

### کنترل دسترسی نقش‌محور (RBAC)

<div dir="ltr">

```python
class RBACAuthorizer:
    ROLE_PERMISSIONS = {
        "admin": ["*"],
        "developer": ["generate", "embed", "fine_tune", "read_metrics"],
        "user": ["generate", "embed"],
        "viewer": ["read_metrics"]
    }
    
    def authorize(self, user: User, action: str) -> bool:
        permissions = self.ROLE_PERMISSIONS.get(user.role, [])
        
        if "*" in permissions:
            return True
        
        return action in permissions
```

</div>

### کنترل دسترسی ویژگی‌محور (ABAC)

<div dir="ltr">

```python
class ABACAuthorizer:
    def __init__(self, policy_engine):
        self.policy_engine = policy_engine
    
    async def authorize(
        self,
        subject: dict,       # Who (user attributes)
        action: str,         # What (operation)
        resource: dict,      # On what (resource attributes)
        context: dict        # When/where (environmental)
    ) -> AuthzResult:
        # Evaluate all applicable policies
        policies = await self.policy_engine.get_policies(action)
        
        for policy in policies:
            result = policy.evaluate(subject, action, resource, context)
            if result == PolicyResult.DENY:
                return AuthzResult(allowed=False, reason=policy.name)
            if result == PolicyResult.ALLOW:
                return AuthzResult(allowed=True)
        
        return AuthzResult(allowed=False, reason="No matching policy")
```

</div>

### مجوزهای سطح مدل (Model-Level Permissions)

<div dir="ltr">

```python
class ModelAccessControl:
    MODEL_TIERS = {
        "claude-fable-5-1": ["enterprise"],
        "claude-opus-5-5": ["enterprise", "professional"],
        "gpt-6-sol": ["enterprise", "professional"],
        "claude-haiku-4-5": ["enterprise", "professional", "starter"],
        "gpt-6-luna": ["enterprise", "professional", "starter"]
    }
    
    def __init__(self, zdr_eligible: set[str]):
        # Load from your vendor agreements, not from code: retention terms are
        # per model (e.g. Fable 5.1 requires 30-day retention unless authorized)
        self.zdr_eligible = zdr_eligible
    
    def can_access_model(self, user: User, model: str) -> bool:
        if user.tier not in self.MODEL_TIERS.get(model, []):
            return False
        if user.tenant.requires_zdr and model not in self.zdr_eligible:
            return False
        return True
    
    def get_available_models(self, user: User) -> list[str]:
        return [
            model for model in self.MODEL_TIERS
            if self.can_access_model(user, model)
        ]
```

</div>

دسترسی به مدل‌ها اکنون در سمت ارائه‌دهنده نیز دروازه‌بانی می‌شود. برنامه تایید سایبری Anthropic (گسترش‌یافته در ۶ اکتبر ۲۰۲۶، با ادغام پروژه Glasswing) دارای سه رده است (Defense، Red Team و Specialized)؛ مدل Mythos 5.1 در همه رده‌ها موجود است، ادمین‌ها برنامه را به فضاهای کاری مشخص تخصیص می‌دهند، و ثبت‌نام نیازمند نگهداری داده است؛ بنابراین استحقاق و شرط نگهداری داده با هم تغییر می‌کنند. مدل `gpt-rosalind-research` شرکت OpenAI تنها برای دسترسی مورد اعتماد است، و مدل Gemini 3.8 Flash Cyber تنها از طریق برنامه Fairwind گوگل عرضه می‌شود. رجیستری مدل در پشت این بررسی باید به تفکیک مدل و پلتفرم ثبت کند که سازمان مجاز به استفاده از کدام مدل‌ها و برنامه‌های دسترسی است، شرایط نگهداری داده آنها چیست، و تاریخ بازنشستگی آنها چه زمانی است؛ تا روتینگ و Fallback هرگز مدلی را که یک مستاجر مجاز به استفاده از آن نیست انتخاب نکنند.

---

## مجوزدهی به ایجنت و ابزار (Agent and Tool Authorization)

زمانی که یک ایجنت ابزارها را از طرف کاربر فراخوانی می‌کند، مجوزدهی شامل سه طرف است: کاربر، ایجنت در نقش کلاینت OAuth، و هر یک از سرورهای ابزار. سال ۲۰۲۶ هم یک مسیر استانداردسازی و هم یک شکست عملی را به همراه داشت.

**شکست عملی: اشتباه سرور مجوزدهی (Authorization-server mix-up).** کیت‌های رسمی توسعه MCP SDK به سرور MCP اجازه می‌دادند تعیین کند کدام سرور مجوزدهی اعتبارات کلاینت را دریافت کند، بنابراین یک سرور مخرب یا نفوذیافته می‌توانست سرور خود را نام ببرد و توکن‌های رفرش و اسرار کلاینت ذخیره‌شده را بدون هیچ تعامل کاربری دریافت کند (شناسه CVE-2026-104850 در تایپ‌اسکریپت و شناسه GHSA-qx49-fqc8-xw99 در پایتون، هر دو با امتیاز CVSS 7.5؛ اصلاح‌شده در تایپ‌اسکریپت 1.31.0 و 2.2.0، و پایتون 1.30.0 و 2.2.0). ارتقای نسخه به تنهایی کافی نیست: ارائه‌دهندگان ماشین-به-ماشین باید با صادرکننده مورد انتظار پیکربندی شوند (`expectedIssuer` در تایپ‌اسکریپت و `issuer=` در پایتون)، و اعتبارات ذخیره‌شده قبل از ارتقا تا زمانی که با صادرکننده خود برچسب‌گذاری یا پاک نشوند، در معرض خطر باقی می‌مانند. یک کلاینت ایجنت چندسروره یک نایب گیج‌شده (Confused deputy) طبیعی است. قاعده اصلی: **هر اعتبار را به صادرکننده آن مقید کنید، و هرگز اجازه ندهید یک سرور منبع انتخاب کند که اسرار به کجا فرستاده شوند.**

**بلوک‌های سازنده:**

| نیاز امنیتی | سازوکار | وضعیت |
|---|---|---|
| توکن قابل استفاده تنها در یک سرور | پیوند مخاطب (RFC 8707 resource indicators) | بخشی از مشخصات احراز هویت MCP، اما SDK تایپ‌اسکریپت توکن‌های صادرشده برای سایر سرویس‌ها را می‌پذیرفت (CVE-2026-111771)؛ اصلاحیه در `sdk` 1.32.0 و `server` 2.3.0 اختیاری (Opt-in) است، بنابراین `expectedResource` را تنظیم کرده و `AuthInfo.resource` را بازگردانید |
| بی‌اثر بودن توکن سرقت‌شده به تنهایی | توکن‌های مقید به فرستنده با DPoP (استاندارد RFC 9449) | در کلاینت MCP TypeScript نسخه 2.1.0 عرضه شد (۲۳ سپتامبر ۲۰۲۶)؛ پیش‌نویس مشخصات (SEP-1932) هنوز یک درفت باز است |
| حداقل دسترسی به ازای هر ابزار | چالش‌های ارتقای دامنه به ازای هر ابزار (خطای HTTP 403 با `insufficient_scope`) | در سرور MCP TypeScript نسخه 2.1.0 عرضه شد |
| کنترل سرورهای مجاز ایجنت توسط IdP سازمانی | گرنت ID-JAG پشت سیستم مدیریت مجوز سازمانی MCP | در MCP عرضه شد؛ پیش‌نویس IETF در وضعیت 04- قرار دارد و هنوز RFC نشده است |
| هویت مستقل برای ایجنت‌های بدون سرپرست (Headless) | هویت بار کاری (Workload identity) به همراه خانواده OAuth، نه پروتکل‌های جدید | کارگروه WIMSE در IETF درفت draft-ietf-wimse-aims-00 را تصویب کرد (۱۵ سپتامبر ۲۰۲۶)؛ فدراسیون هویت بار کاری در MCP (سند SEP-1933) یک درفت باز است |

**تاییدیه‌ها نیز نوعی مجوزدهی هستند:** تایید انسانی به ازای هر فراخوانی مقیاس‌پذیر نیست، بنابراین پلتفرم‌ها به سمت خط‌مشی‌های سیاستی حرکت می‌کنند: سیاست مجوزدهی خودکار در Claude Managed Agents (۱۰ سپتامبر ۲۰۲۶) کاری می‌کند که سرور هر فراخوانی ابزار ایجنت یا MCP را ارزیابی کند و آن را اجرا نماید، رد کند، یا برای تایید متوقف سازد. در جایی که انسان‌ها تایید را انجام می‌دهند، تاییدیه را دقیقاً به همان فراخوانی مقید کنید: تحقیقات درباره شستشوی تاییدیه (Approval laundering به شناسه arXiv 2609.38983) نشان می‌دهد اکشنی که یک فرد تایید می‌کند همیشه همان اکشنی نیست که محیط اجرای دستیار کدنویسی اجرا می‌نماید.

**یک چک‌لیست دولتی برای هویت ایجنت:** مرکز ملی تعالی امنیت سایبری NIST (یا NCCoE) در ۲۷ اکتبر ۲۰۲۶ ده «اصل طراحی برای سیستم‌های مدیریت هویت ایجنت» را منتشر کرد (یک پست وبلاگی بدون شماره انتشار رسمی NIST، بنابراین یک نقطه شروع پیش‌نویس است نه یک استاندارد قطعی). این اصول با قواعد این فصل مطابقت دارند: هویت متمایز به ازای هر ایجنت؛ پیوند رمزنگاری‌شده به طرف آغازگر، با اختیارات تفویض‌شده‌ای که تنها می‌تواند محدودتر شود؛ حداقل دسترسی و عدم وجود دسترسی دائمی (Zero standing privilege)؛ مجوزهای کوتاه‌مدت، مختص به تسک، و قابل ابطال بدون توکن‌های حامل بلندمدت؛ محرک‌های حضور انسان در حلقه برای جلوگیری از خستگی ناشی از موافقت (Consent fatigue)؛ ماموریت‌های امضاشده از سوی آغازگران تسک؛ تفکیک تصمیمات سیاستی از استدلال مدل؛ تصمیمات اولیه دسترسی قطعی و معین؛ مانیتورینگ اختصاصی ایجنت؛ و شواهد فقط-افزودنی که ایجنت امکان دستکاری آنها را ندارد. این یک چک‌لیست بازبینی بسیار سودمند برای طراحی پلتفرم‌های ایجنت است.

**دسترسی مدل تفویض‌شده از طرف کاربر:** قابلیت ورود با ChatGPT (Sign in with ChatGPT، معرفی‌شده در DevDay شرکت OpenAI در ۲۹ سپتامبر ۲۰۲۶؛ در فاز آزمایشی محدود برای شرکای منتخب) از پروتکل OAuth 2.0 همراه با PKCE و OpenID Connect استفاده می‌کند و می‌تواند به درخواست‌های واجد شرایط Responses API اجازه دهد روی پلن ChatGPT خود کاربر اجرا شوند. این قابلیت هویتی راحتی به همراه دارد، اما ورود به سیستم و صورت‌حساب هوش مصنوعی را در یک ارائه‌دهنده متمرکز می‌کند؛ با آن مانند هر تصمیم دیگری در زمینه وابستگی به ارائه‌دهنده هویت (IdP lock-in) برخورد کنید.

جزئیات در سطح پروتکل، از جمله مدیریت مجوز سازمانی، در فصل [استفاده از ابزار و پروتکل MCP](../07-agentic-systems/03-tool-use-and-mcp.md) آمده است.

---

## ایزوله‌سازی مستاجران (Tenant Isolation)

### الگوهای ایزوله‌سازی داده‌ها

<div dir="ltr">

```python
class TenantIsolatedVectorStore:
    def __init__(self, vector_db):
        self.db = vector_db
    
    async def search(
        self,
        tenant_id: str,
        query_embedding: list[float],
        top_k: int = 10
    ) -> list[dict]:
        # CRITICAL: Always filter by tenant_id at database level
        results = await self.db.search(
            query_vector=query_embedding,
            top_k=top_k,
            filter={"tenant_id": {"$eq": tenant_id}}  # Mandatory filter
        )
        
        return results
    
    async def insert(
        self,
        tenant_id: str,
        documents: list[dict]
    ):
        # CRITICAL: Always include tenant_id in metadata
        for doc in documents:
            doc["metadata"]["tenant_id"] = tenant_id
        
        await self.db.insert(documents)
```

</div>

### ایزوله‌سازی پرامپت

<div dir="ltr">

```python
class TenantAwarePromptBuilder:
    def build_prompt(
        self,
        tenant_id: str,
        user_query: str,
        context: list[dict]
    ) -> str:
        # Verify all context belongs to tenant
        for doc in context:
            if doc.get("tenant_id") != tenant_id:
                raise SecurityError("Cross-tenant context detected")
        
        # Build isolated prompt
        return f"""
[Tenant: {tenant_id}]
Context from tenant documents:
{self.format_context(context)}

User query: {user_query}
"""
```

</div>

### ایزوله‌سازی کش

<div dir="ltr">

```python
class TenantIsolatedCache:
    def __init__(self, cache_backend):
        self.cache = cache_backend
    
    def _scoped_key(self, tenant_id: str, key: str) -> str:
        return f"tenant:{tenant_id}:{key}"
    
    async def get(self, tenant_id: str, key: str) -> any:
        return await self.cache.get(self._scoped_key(tenant_id, key))
    
    async def set(self, tenant_id: str, key: str, value: any, ttl: int = 3600):
        await self.cache.set(
            self._scoped_key(tenant_id, key),
            value,
            ttl=ttl
        )
```

</div>

ایزوله‌سازی کش به داخل موتور استنتاج نیز نفوذ می‌کند. کش پیشوند مشترک یک کانال جانبی زمانی است: اگر درخواست مستاجر B سریع‌تر بازگردد به این دلیل که مستاجر A قبلاً همان پیشوند را کش کرده است، مستاجر B اطلاعاتی در مورد پرامپت مستاجر A به دست می‌آورد. ابزار vLLM مستاجران را با یک `cache_salt` به ازای هر درخواست ایزوله می‌کند، و در سپتامبر ۲۰۲۶ یک بازگشت باگ در یک مسیر کد (نوبت‌های ادامه ابزار روی اندپوینت Harmony `/v1/responses` نمک کش را حذف می‌کرد) این روزنه اوراکل را تا نسخه 0.30.0 مجدداً باز کرد (کف نسخه فعلی vLLM نسخه 0.32.0 است؛ بخش [امن‌سازی خود پشته هوش مصنوعی](01-llm-security.md#securing-the-ai-stack-itself) را ببینید). در هر درخواست یک نمک به ازای هر مستاجر ارسال کنید، هر اندپوینت را برای آن تست نمایید، و زمانی که مستاجران زیادی از یک حساب ارائه‌دهنده مشترک استفاده می‌کنند، محتوای خاص هر مستاجر را بعد از پیشوند پایدار و قابل کش‌سازی قرار دهید.

همین نقص در سرورهای پروتکل ظاهر می‌شود. در کیت توسعه MCP TypeScript SDK، یک سرور HTTP که یک ترنسپورت یا نمونه سرور را در زمان راه‌اندازی می‌ساخت و آن را میان کلاینت‌ها به اشتراک می‌گذاشت، می‌توانست پاسخ‌های یک کلاینت را به کلاینت دیگر تحویل دهد (شناسه CVE-2026-111770 با امتیاز CVSS 7.7 در `@modelcontextprotocol/server` نسخه 2.0.0 تا 2.2.x)، زیرا پیام‌ها تنها با شناسه JSON-RPC به اتصالات تطبیق داده می‌شدند و تمام کلاینت‌های SDK درخواست‌های خود را از ۰ شماره‌گذاری می‌کردند. حتی مثال‌های فایل README خود SDK همین الگوی اشتراکی را نشان می‌دادند. نسخه 2.3.0 آن را رد می‌کند، بنابراین ارتقا باعث از کار افتادن آن برنامه‌ها می‌شود تا زمانی که هر درخواست یا نشست سرور و ترنسپورت مجزای خود را دریافت کند. هر وضعیت به ازای اتصال در یک سرور چندمستاجره، نه صرفاً کش‌ها، نیازمند یک کلید مستاجر یا نشست است.

---

## مدیریت کلیدهای API (API Key Management)

### چرخه حیات کلید

<div dir="ltr">

```python
class APIKeyManager:
    KEY_PREFIX = "llm_"
    
    async def create_key(
        self,
        user_id: str,
        tenant_id: str,
        name: str,
        scopes: list[str],
        expires_in_days: int = 365
    ) -> APIKey:
        # Generate secure key
        raw_key = self.KEY_PREFIX + secrets.token_urlsafe(32)
        key_hash = self.hash_key(raw_key)
        
        # Store metadata (not the raw key)
        key_record = APIKeyRecord(
            id=generate_id(),
            hash=key_hash,
            user_id=user_id,
            tenant_id=tenant_id,
            name=name,
            scopes=scopes,
            created_at=datetime.now(),
            expires_at=datetime.now() + timedelta(days=expires_in_days)
        )
        
        await self.store.save(key_record)
        
        # Return raw key only once (not stored)
        return APIKey(
            id=key_record.id,
            key=raw_key,  # Only returned on creation
            name=name,
            scopes=scopes,
            expires_at=key_record.expires_at
        )
    
    async def revoke_key(self, key_id: str, reason: str):
        await self.store.update(key_id, {
            "revoked": True,
            "revoked_at": datetime.now(),
            "revoke_reason": reason
        })
        
        await self.audit_log.log("api_key_revoked", {
            "key_id": key_id,
            "reason": reason
        })
```

</div>

### تعویض دوره‌ای کلید (Key Rotation)

<div dir="ltr">

```python
class KeyRotator:
    async def rotate_key(self, old_key_id: str) -> APIKey:
        old_key = await self.key_store.get(old_key_id)
        
        # Create new key with same permissions
        new_key = await self.key_manager.create_key(
            user_id=old_key.user_id,
            tenant_id=old_key.tenant_id,
            name=f"{old_key.name} (rotated)",
            scopes=old_key.scopes
        )
        
        # Grace period: old key still works temporarily
        await self.key_store.update(old_key_id, {
            "deprecated": True,
            "deprecated_at": datetime.now(),
            "grace_period_ends": datetime.now() + timedelta(days=7)
        })
        
        await self.notify_user(old_key.user_id, new_key)
        
        return new_key
```

</div>

---

## ممیزی و انطباق (Audit and Compliance)

### ثبت لاگ‌های ممیزی

<div dir="ltr">

```python
class AuditLogger:
    async def log_request(
        self,
        request: LLMRequest,
        response: LLMResponse,
        auth: AuthResult
    ):
        audit_entry = {
            "timestamp": datetime.now().isoformat(),
            "request_id": request.id,
            "user_id": auth.user_id,
            "tenant_id": auth.tenant_id,
            "action": "llm_generate",
            "model": request.model,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "cost": response.cost,
            "latency_ms": response.latency_ms,
            # Hash content for privacy
            "input_hash": self.hash_content(request.prompt),
            "output_hash": self.hash_content(response.content)
        }
        
        await self.audit_store.append(audit_entry)
```

</div>

### گزارش‌های انطباق قانونی

<div dir="ltr">

```python
class ComplianceReporter:
    async def generate_report(
        self,
        tenant_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> ComplianceReport:
        logs = await self.audit_store.query(
            tenant_id=tenant_id,
            start=start_date,
            end=end_date
        )
        
        return ComplianceReport(
            tenant_id=tenant_id,
            period=(start_date, end_date),
            total_requests=len(logs),
            unique_users=len(set(l["user_id"] for l in logs)),
            models_used=list(set(l["model"] for l in logs)),
            total_cost=sum(l["cost"] for l in logs),
            data_access_events=self.extract_data_access(logs),
            security_events=await self.get_security_events(tenant_id, start_date, end_date)
        )
```

</div>

---

## پرسش‌های مصاحبه (Interview Questions)

### پرسش: ایزوله‌سازی چندمستاجره را در یک سیستم RAG چگونه پیاده‌سازی می‌کنید؟

**پاسخ قوی:**
ایزوله‌سازی چندمستاجره نیازمند دفاع در عمق است:

**در سطح پایگاه داده برداری:**
- هر بردار شامل tenant_id در متادیتا است
- تمام کوئری‌ها بر اساس tenant_id در سطح دیتابیس فیلتر می‌شوند
- هرگز پس از بازیابی فیلتر نکنید (زیرا داده‌ها قبلاً به حافظه نشت کرده‌اند)

**در سطح کش:**
- تمام کلیدهای کش با شناسه tenant_id پیشوندگذاری می‌شوند
- کش معنایی به دامنه مستاجر محدود می‌شود
- عدم اصابت کش میان‌مستاجره حتی برای کوئری‌های کاملاً یکسان

**در سطح پرامپت:**
- اعتبارسنجی اینکه اسناد کانتکست متعلق به مستاجر درخواست‌دهنده هستند قبل از گنجاندن در پرامپت
- هرگز کانتکست مستاجران مختلف را با هم ترکیب نکنید

**در سطح خروجی:**
- بررسی اینکه پاسخ حاوی اطلاعات میان‌مستاجره نباشد
- فیلتر کردن خروجی به عنوان حفاظ مضاعف

**در سطح ممیزی و بازرسی:**
- ثبت لاگ تمام دسترسی‌ها با کانتکست مستاجر
- پایش برای کشف تلاش‌های دسترسی متقاطع

اصل کلیدی: پارامتر tenant_id یک فیلتر اجباری در هر نقطه دسترسی به داده است، نه یک پارامتر اختیاری.

### پرسش: کلیدهای API را برای یک سرویس LLM چگونه مدیریت می‌کنید؟

**پاسخ قوی:**
مدیریت امن کلیدهای API:

**ساخت و صدور:**
- تولید کلیدهای تصادفی امن از نظر رمزنگاری
- ذخیره تنها هش کلید، و بازگرداندن کلید خام تنها برای یک بار
- انتساب به کاربر، مستاجر، دامنه‌ها (Scopes)، و تاریخ انقضا

**اعتبارسنجی:**
- هش کردن کلید ورودی و مقایسه آن با هش ذخیره‌شده
- بررسی وضعیت انقضا و ابطال
- بررسی تطابق دامنه‌ها با اکشن درخواستی

**تعویض دوره‌ای (Rotation):**
- پشتیبانی از تعویض کلید همراه با دوره تنفس (Grace period)
- کلید قدیمی در طول دوره گذار کار می‌کند (مثلاً ۷ روز)
- اطلاع‌رسانی به کاربران درباره انقضای قریب‌الوقوع

**امنیت:**
- محدودسازی نرخ تلاش‌های ناموفق احراز هویت
- ابطال فوری در صورت ظن به نفوذ
- ثبت لاگ ممیزی تمام عملیات کلید

**دامنه‌های دسترسی (Scopes):**
- ریزدانه: دسترسی به مدل، نوع عملیات، سقف‌های روزانه
- حداقل سطح دسترسی (Least privilege) به‌صورت پیش‌فرض

**کلیدهایی که نگهداری می‌کنیم، نه فقط کلیدهایی که صادر می‌کنیم:**
- برای فراخوانی‌های خودمان به ارائه‌دهندگان مدل، هویت بار کاری (mTLS یا توکن‌های فدرال) را بر کلیدهای استاتیک ترجیح می‌دهیم، و برای هر کلید باقیمانده مالک، انقضا و سقف هزینه تعیین می‌کنیم
- کلیدهای API مدل‌های LLM اکنون غنایم استاندارد کرم‌های زنجیره تامین هستند، بنابراین آنها را از سیستم‌های توسعه‌دهندگان، نشست‌های ایجنت و لاگ‌های CI دور نگه می‌دارم
- یک درگاه آنها را متمرکز می‌کند: نسخه‌های آلوده LiteLLM در ۲۱ اکتبر ۲۰۲۶ کلیدهای ارائه‌دهندگان و کلیدهای اصلی و مجازی پراکسی را جمع‌آوری کردند، بنابراین من باید بتوانم تمام کلیدهای نگهداری‌شده در درگاه را در یک مرحله تعویض کنم

اصل کلیدی: هرگز کلیدهای خام را ذخیره نکنید، از تعویض کلید پشتیبانی کنید، و حداقل سطح دسترسی را پیاده نمایید.

### پرسش: یک ایجنت ابزارها را روی پنج سرور پروتکل MCP از طرف یک کاربر فراخوانی می‌کند. چگونه آن را مجوزدهی می‌کنید؟

**پاسخ قوی:**
من سیستم را در برابر آسیب‌پذیری نایب گیج‌شده (Confused deputy) طراحی می‌کنم، زیرا ایجنت اعتبارات پنج سرور را در اختیار دارد و هر یک از آنها ممکن است مخرب یا نفوذیافته باشند.

**پیوند دادن اعتبارات به صادرکننده و مخاطب:** هر توکن بر اساس RFC 8707 به سرور مقصد خود پیوند داده می‌شود (Audience-bound)، و هر اعتبار ذخیره‌شده با سرور مجوزدهی که آن را صادر کرده برچسب‌گذاری می‌شود و هرگز به جای دیگری فرستاده نمی‌شود. این دقیقاً همان شکافی بود که در سپتامبر ۲۰۲۶ در کیت MCP TypeScript SDK رخ داد (کد CVE-2026-104850؛ کیت پایتون نیز همین نقص را داشت): یک سرور مخرب می‌توانست سرور مجوزدهی خود را نام ببرد و توکن‌های رفرش و اسرار کلاینت را جمع‌آوری کند. ارتقای SDK کافی نیست؛ کلاینت‌های ماشین-به-ماشین نیازمند یک صادرکننده مورد انتظار صریح هستند، و اعتبارات پیش از ارتقا باید مجدداً برچسب‌گذاری یا پاک شوند. در سمت سرور، پیوند مخاطب تنها زمانی کمک می‌کند که سرور آن را بررسی کند: اصلاحیه اکتبر در SDK تایپ‌اسکریپت (CVE-2026-111771) اختیاری است، بنابراین هر سروری که اجرا می‌کنم پارامتر `expectedResource` را تنظیم می‌کند.

**کاهش کارایی توکن‌های سرقت‌شده:** طول عمرهای کوتاه، و توکن‌های مقید به فرستنده DPoP در جاهایی که کلاینت و سرور پشتیبانی می‌کنند.

**حداقل سطح دسترسی به ازای هر ابزار:** دامنه‌های پیش‌فرض محدود با چالش‌های ارتقای دسترسی به ازای هر ابزار، تا یک نشست فقط-خواندنی نتواند بی‌صدا یک ابزار نوشتن را فراخوانی کند.

**کنترل سازمانی:** در جایی که شرکت یک IdP اجرا می‌کند، سیستم مدیریت مجوز سازمانی به ادمین‌ها اجازه می‌دهد به‌صورت متمرکز تعیین کنند ایجنت به کدام سرورها دسترسی دارد. برای ایجنت‌های بدون سرپرست (Headless)، به جای توکن بلندمدت کاربر، هویت بار کاری مستقل به ایجنت اختصاص می‌دهم.

**تایید و ممیزی:** فراخوانی‌های پرخطر از یک موتور سیاست یا تایید انسانی عبور می‌کنند، به گونه‌ای که تاییدیه دقیقاً به همان فراخوانی اجراشده مقید است، و تمام فراخوانی‌ها همراه با کاربر، ایجنت، سرور و دامنه ثبت لاگ می‌شوند.

استانداردها هنوز در حال تکامل هستند (DPoP برای MCP و فدراسیون هویت بار کاری هنوز پیش‌نویس هستند، و ID-JAG هنوز RFC نشده است)، بنابراین لایه مجوزدهی را پشت اینترفیس اختصاصی خود نگه می‌دارم و انتظار تعویض قطعات را دارم.

---

## مراجع (References)

- پروتکل احراز هویت OAuth 2.0: https://oauth.net/2/
- امنیت API بر اساس OWASP: https://owasp.org/API-Security/
- سند RFC 8707، نشانگرهای منبع برای OAuth 2.0: https://www.rfc-editor.org/rfc/rfc8707
- سند RFC 9449، اثبات تصرف کلید (DPoP) در OAuth 2.0: https://www.rfc-editor.org/rfc/rfc9449
- اطلاعیه امنیتی MCP TypeScript SDK شناسه GHSA-6qxp-vccf-f47h (کد CVE-2026-104850): https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h
- اطلاعیه‌های امنیتی MCP TypeScript SDK شناسه‌های GHSA-jm63-cq47-j5jp (کد CVE-2026-111770) و GHSA-rvq5-wwqv-78pq (کد CVE-2026-111771): https://github.com/modelcontextprotocol/typescript-sdk/security/advisories
- شرکت Anthropic، برنامه توسعه‌یافته Cyber Verification Program (۶ اکتبر ۲۰۲۶): https://www.anthropic.com/news/cyber-verification-program
- گروه اطلاعات تهدیدات گوگل، سرقت منابع ابری LLMjacking (۳ نوامبر ۲۰۲۶): https://cloud.google.com/blog/topics/threat-intelligence/llmjacking-monetizing-compromised-cloud-models
- مرکز NCCoE متعلق به NIST، اصول طراحی سیستم‌های مدیریت هویت ایجنت (۲۷ اکتبر ۲۰۲۶): https://www.nist.gov/blogs/cybersecurity-insights/design-tenets-agent-identity-management-systems
- کارگروه IETF WIMSE، سیستم مدیریت هویت هوش مصنوعی (draft-ietf-wimse-aims): https://datatracker.ietf.org/doc/draft-ietf-wimse-aims/
- گزارش تغییرات API شرکت OpenAI (هویت بار کاری، انقضای کلید): https://developers.openai.com/api/docs/changelog

---

*قبلی: [امنیت مدل‌های بزرگ زبان](01-llm-security.md)*

</div>