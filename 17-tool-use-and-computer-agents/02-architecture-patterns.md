<div dir="rtl">

# الگوهای معماری برای Agentهای ابزارمحور (Tool-Use Agents)

تمام Agentهای ابزارمحور در سال ۲۰۲۶، از OpenClaw گرفته تا Claude Code و Agentهای ابری Cursor، بر پایه یکی از چند الگوی معماری هسته‌ای ساخته شده‌اند. درک این الگوها به شما امکان می‌دهد به‌جای کپی‌برداری از ابزارهای خاص، Agentها را از اصول اولیه (First Principles) طراحی کنید. این فصل هر الگو را با نمودارهای دقیق، نمونه‌کدها، موازنه‌ها (Trade-offs) و راهنمایی درباره زمان استفاده از هر کدام بررسی می‌کند.

## فهرست مطالب

- [الگوی ۱: فراخوانی تابع و ابزار (Function/Tool Calling)](#pattern-1-functiontool-calling)
- [الگوی ۲: خودکارسازی مبتنی بر بینایی (Vision-Based Automation)](#pattern-2-vision-based-automation)
- [الگوی ۳: اجرای کد محلی (Local Code Execution)](#pattern-3-local-code-execution)
- [الگوی ۴: ارکستراسیون ابزار چند-Agentی (Multi-Agent Tool Orchestration)](#pattern-4-multi-agent-tool-orchestration)
- [اجرای ایزوله‌شده در سندباکس در برابر اجرای بدون سندباکس](#sandboxed-vs-unsandboxed-execution)
- [مدیریت وضعیت در سراسر فراخوانی‌های ابزار](#state-management-across-tool-calls)
- [الگوهای مدیریت خطا و تلاش مجدد](#error-handling-and-retry-patterns)
- [الگوهای یکپارچه‌سازی MCP](#mcp-integration-patterns)
- [درخت تصمیم معماری](#architecture-decision-tree)
- [زاویه دید مصاحبه طراحی سیستم](#system-design-interview-angle)
- [سوالات مصاحبه](#interview-questions)
- [منابع](#references)

---

## الگوی ۱: فراخوانی تابع و ابزار (Function/Tool Calling) <a id="pattern-1-functiontool-calling"></a>

پراستفاده‌ترین الگو در محیط‌های عملیاتی (Production). مدل LLM تصمیم می‌گیرد کدام ابزار را با چه آرگومان‌هایی فراخوانی کند؛ یک فریم‌ورک (Framework) فراخوانی را اجرا می‌کند؛ و نتایج برای گام استدلال بعدی به مکالمه بازگردانده می‌شوند.

### معماری

<div dir="ltr">

```
+-------------------------------------------------------------------+
|              Function/Tool Calling Pattern                        |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+                                             |
|  |  User Message     |                                            |
|  +--------+---------+                                             |
|           |                                                       |
|           v                                                       |
|  +--------+---------+     +------------------+                    |
|  |  LLM Reasoning   |---->|  Tool Selection  |                   |
|  |                   |     |                  |                    |
|  |  "I need to look  |     |  tool: search_db |                   |
|  |   up the order"  |     |  args: {id: 42}  |                    |
|  +-------------------+     +--------+---------+                   |
|                                     |                             |
|                                     v                             |
|                            +--------+---------+                   |
|                            |  Tool Executor   |                   |
|                            |  (Framework)     |                   |
|                            |                  |                   |
|                            |  Validates args  |                   |
|                            |  Calls function  |                   |
|                            |  Returns result  |                   |
|                            +--------+---------+                   |
|                                     |                             |
|                                     v                             |
|                            +--------+---------+                   |
|                            |  Result Injected |                   |
|                            |  into Context    |                   |
|                            |                  |                   |
|                            |  {status: "shipped",                 |
|                            |   tracking: "1Z..."} |               |
|                            +--------+---------+                   |
|                                     |                             |
|                                     v                             |
|                            +--------+---------+                   |
|                            |  LLM Generates   |                   |
|                            |  Final Response  |                   |
|                            +------------------+                   |
+-------------------------------------------------------------------+
```

</div>

### جزئیات سه گام اصلی

**گام ۱: ارائه طرحواره (Schema Presentation).** مدل یک طرحواره JSON دریافت می‌کند که ابزارهای در دسترس را توصیف می‌کند. در سال ۲۰۲۶، بهترین شیوه استفاده از مانیفست‌های پویا (Dynamic Manifests) است که بر اساس قصد کاربر فقط ابزارهای مرتبط را واکشی می‌کنند، به‌جای آنکه تمام طرحواره‌های ابزار را از ابتدا بارگذاری کنند. اکنون ارائه‌دهندگان این قابلیت را عرضه کرده‌اند: نسخه بتای `inline-tools-2026-09-15` شرکت Anthropic ابزارها را در میانه مکالمه اضافه یا جایگزین می‌کند بدون آنکه کش Prompt (Prompt Cache) را باطل کند؛ ابزار Cursor گزارش داده که انتقال ابزارهای MCP به زمینه پویا (Dynamic Context) مجموع واحدهای Token را در جلساتی که حداقل یک ابزار فراخوانی شده ۴۶.۹ درصد کاهش داده است (طبق گزارش ارائه‌دهنده)؛ و کشف تدریجی سمت سرور (Server-side Progressive Discovery) برای کاتالوگ‌های بزرگ در نقشه راه اوت ۲۰۲۶ پروتکل MCP قرار دارد.

**گام ۲: تشخیص قصد و استخراج (Intent and Extraction).** مدل یک فراخوانی ابزار ساخت‌یافته (Structured Tool Call) تولید می‌کند. این خروجی متن آزاد نیست؛ بلکه یک شیء JSON با فیلدهای `tool_name` و `arguments` است که فریم‌ورک می‌تواند آن را به‌صورت قطعی (Deterministic) تجزیه کند. **اجبار به فراخوانی ابزار اکنون به مدل وابسته است**: مقدار `tool_choice` از نوع `any` یا `tool` در مدل‌های Claude Fable 5.1، Mythos 5.1، Opus 5.5 و Sonnet 5.5 خطای HTTP 400 برمی‌گرداند. از `auto` به‌همراه تعریف دقیق ابزارها استفاده کنید، یا زمانی که به طرحواره تضمینی نیاز دارید از خروجی‌های ساخت‌یافته (Structured Outputs) بهره ببرید. هارنس‌هایی (Harnesses) که برای استخراج یا مسیریابی به اجبار فراخوانی ابزار متکی بودند، پیش از مهاجرت به این مدل‌ها نیاز به بازنویسی دارند. شرکت OpenAI نیز نسخه خاص خود از این محدودیت را دارد: مدل GPT-6 Astra فراخوانی ابزار را فقط از طریق Responses API پشتیبانی می‌کند، بنابراین یک هارنس مبتنی بر Chat Completions نمی‌تواند به‌سادگی شناسه مدل جدید را جایگزین کند.

**گام ۳: اجرا و زمینه‌سازی (Execution and Contextualization).** فریم‌ورک آرگومان‌ها را اعتبارسنجی می‌کند (با استفاده از Pydantic، Zod یا ابزارهای مشابه)، تابع را فراخوانی می‌نماید و نتیجه را به‌عنوان یک پیام جدید با نقش `tool` دوباره به مکالمه تزریق می‌کند.

### نمونه‌کد: سرور و کلاینت MCP

<div dir="ltr">

```python
# MCP Server (Python SDK 2.x, where FastMCP was renamed MCPServer)
from typing import Annotated
from mcp.server import MCPServer
from pydantic import Field

mcp = MCPServer("order-service")

@mcp.tool()
async def lookup_order(
    order_id: Annotated[str, Field(description="The order UUID")],
) -> dict:
    """Look up an order by ID. DO NOT use for canceled orders."""
    order = await db.orders.find_one({"id": order_id})
    if not order:
        return {"error": "Order not found", "suggestion": "Check order ID format"}
    return {"status": order["status"], "tracking": order.get("tracking_number")}
```

</div>

<div dir="ltr">

```python
# MCP Client: agent discovers tools dynamically, calls them, feeds results back
listed = await mcp_client.list_tools()
tools = [to_model_tool_schema(t) for t in listed.tools]  # MCP listing -> model API format
response = client.messages.create(model="claude-sonnet-5-5", max_tokens=16000, tools=tools,
    messages=[{"role": "user", "content": "Where is my order ORD-12345?"}])

if response.stop_reason == "tool_use":
    # Thinking or text blocks can precede the call, so never assume content[0]
    tool_call = next(b for b in response.content if b.type == "tool_use")
    result = await mcp_client.call_tool(tool_call.name, tool_call.input)
    # Append the full assistant turn (thinking blocks included), then a tool_result block
```

</div>

دستور `pip install mcp` از تاریخ ۲۸ ژوئیه ۲۰۲۶ به SDK نسخه 2.x اشاره می‌کند، بنابراین آموزش‌هایی که `FastMCP` را وارد (import) می‌کنند روی یک نصب تازه با خطا مواجه می‌شوند؛ اگر هنوز آماده مهاجرت نیستید نسخه `mcp<2` را پین کنید. همچنین Python SDK 2.1+ نحوه نمایش خطا را تغییر داده است: یک استثنای غیرمنتظره در هندلر (Handler) فقط به‌صورت «Error executing tool <name>» به کلاینت می‌رسد، بنابراین برای پیام‌هایی که مدل باید ببیند استثنای `ToolError` را پرتاب (raise) کنید.

### چه زمانی از این الگو استفاده کنیم

- یکپارچه‌سازی‌های API (پایگاه‌های داده، ابزارهای SaaS، سرویس‌های داخلی)
- بازیابی و تغییر داده‌های ساخت‌یافته
- هر جریان کاری که در آن بتوانید رابط ابزار را از پیش تعریف کنید
- سیستم‌های عملیاتی که در آن‌ها به ردپای ممیزی (Audit Trail) و اعتبارسنجی ورودی نیاز دارید

### موازنه‌ها (Trade-offs)

| مزیت | عیب |
|------|-----|
| اجرای قطعی (Deterministic) | نیازمند تعریف طرحواره ابزار از پیش |
| ممیزی و ثبت لاگ آسان | عدم امکان تعامل با رابط‌های کاربری دلخواه |
| سرعت بالا (۵۰ تا ۲۰۰ میلی‌ثانیه به ازای هر فراخوانی ابزار) | احتمال توهم (Hallucination) مدل در نام یا آرگومان‌های ابزار |
| سازگار با هر مدل LLM دارای قابلیت استفاده از ابزار | سربار طرحواره (Schema Overload) در صورت زیاد بودن ابزارها |

---

## الگوی ۲: خودکارسازی مبتنی بر بینایی (Vision-Based Automation) <a id="pattern-2-vision-based-automation"></a>

مدل یک اسکرین‌شات از صفحه نمایش را می‌بیند، درباره کار بعدی استدلال می‌کند و یک عمل سطح پایین (کلیک، تایپ، اسکرول) صادر می‌کند. محیط آن عمل را اجرا می‌کند، اسکرین‌شات جدیدی می‌گیرد و این حلقه تکرار می‌شود. مجموعه ابزار رایانه Claude، قابلیت Computer Use در Gemini و رابط Computer API در نسخه اولیه پایتونی Open Interpreter دقیقاً به همین شکل کار می‌کنند.

### معماری

<div dir="ltr">

```
+-------------------------------------------------------------------+
|              Vision-Based Automation Pattern                      |
+-------------------------------------------------------------------+
|                                                                   |
|  +------------------+                                             |
|  |  Task Goal        |  "Fill out the expense form with           |
|  |  (NL instruction) |   last week's receipts"                    |
|  +--------+---------+                                             |
|           |                                                       |
|           v                                                       |
|  +--------+--------------------------------------------------+    |
|  |                    VISION-ACTION LOOP                      |    |
|  |                                                            |    |
|  |   +------------+    +-------------+    +------------+     |    |
|  |   |  OBSERVE   |    |  REASON     |    |  ACT       |     |    |
|  |   |            |    |             |    |            |     |    |
|  |   | Screenshot |--->| Analyze     |--->| Emit action|     |    |
|  |   | (base64)   |    | screenshot  |    | {type:     |     |    |
|  |   |            |    | + goal      |    |  "click",  |     |    |
|  |   |            |    | + history   |    |  x: 450,   |     |    |
|  |   |            |    | + prev acts |    |  y: 320}   |     |    |
|  |   +-----^------+    +-------------+    +------+-----+     |    |
|  |         |                                      |          |    |
|  |         +--------------------------------------+          |    |
|  |                    (Loop until done)                       |    |
|  +-----------------------------------------------------------+    |
|                            |                                      |
|                            v                                      |
|  +-------------------------+------------------------------+       |
|  |         Sandboxed Environment (VM / Docker + VNC)      |       |
|  |                                                        |       |
|  |   +----------+  +----------+  +----------+            |       |
|  |   | Desktop  |  | Browser  |  | Apps     |            |       |
|  |   | (Xfce)   |  | (Chrome) |  | (any)    |            |       |
|  |   +----------+  +----------+  +----------+            |       |
|  +--------------------------------------------------------+       |
+-------------------------------------------------------------------+
```

</div>

### چرخه مشاهده-استدلال-عمل (Observe-Reason-Act)

**مشاهده (Observe):** گرفتن یک اسکرین‌شات از وضعیت فعلی صفحه نمایش. در Claude Computer Use، این تصویر یک PNG با کدگذاری base64 است که به‌عنوان یک بلوک محتوای تصویری ارسال می‌شود و بر اساس برآورد Anthropic، حدود ۱٬۰۰۰ تا ۱٬۸۰۰ واحد Token ورودی به ازای هر اسکرین‌شات مصرف می‌کند. قابلیت Zoom Action (جدید در سال ۲۰۲۶ و فعال به‌صورت پیش‌فرض در مجموعه ابزار GA) امکان گرفتن برش با وضوح بالا از یک ناحیه مشخص را برای رابط‌های کاربری متراکم فراهم می‌کند. مجموعه ابزار GA در Claude هیچ ابعاد نمایشگری دریافت نمی‌کند: مدل مختصات را در فضای پیکسلی همان اسکرین‌شات‌هایی که برمی‌گردانید می‌خواند.

**استدلال (Reason):** مدل LLM چندوجهی (Multimodal) اسکرین‌شات را در کنار هدف وظیفه و تاریخچه عمل‌ها تحلیل می‌کند و تصمیم می‌گیرد عمل بعدی چه باشد. این مرحله بیشترین مصرف Token را دارد.

**عمل (Act):** مدل یک عمل ساخت‌یافته صادر می‌کند:
- دستور `left_click(x, y)`: کلیک روی مختصات مشخص
- دستور `type(text)`: تایپ یک رشته متنی
- دستور `key(key_combo)`: فشردن کلید میانبر صفحه کلید
- دستور `scroll(direction, amount)`: پیمایش (اسکرول) صفحه
- دستور `screenshot()`: گرفتن اسکرین‌شات جدید بدون انجام عمل
- دستور `zoom(x0, y0, x1, y1)`: بررسی یک ناحیه با وضوح بالا

### عمل‌های دسته‌ای و ارجاع به عناصر (Batch Actions and Element References)

دو تغییر در سال ۲۰۲۶ این حلقه را دگرگون کرده‌اند. نخست، **عمل‌های دسته‌ای (Batch Actions)**: مجموعه ابزار رایانه GA شرکت Claude (عرضه‌شده در ۱۹ اوت ۲۰۲۶) به مدل اجازه می‌دهد چندین بلوک `tool_use` را در یک نوبت برگرداند. اجراکننده آن‌ها را به ترتیب اجرا می‌کند و در اولین شکست متوقف می‌شود و به تمام بلوک‌های بعدی به‌جای اجرا، پاسخ خطا می‌دهد. اکنون یک رفت‌وبرگشت به مدل چندین گام رابط کاربری گرافیکی (GUI) را پوشش می‌دهد که مدل تاخیر (Latency) و هزینه را تغییر می‌دهد. همچنین به این معناست که تایید انسانیِ قرارگرفته بین نوبت‌های مدل دیر می‌رسد، زیرا یک نوبت منفرد می‌تواند یک عمل حساس چندمرحله‌ای را به پایان برساند. مستندات Anthropic این بررسی را پیش از اجرای هر بلوک قرار می‌دهند: هنگام رسیدن دسته، تک‌تک عمل‌ها را بازرسی کنید، پیش از هر عمل حساس مکث نمایید و رد شدن توسط کاربر را مانند یک شکست تلقی کنید تا بقیه دسته به‌عنوان اجرا نشده پاسخ داده شوند.

دوم، **هدف‌گذاری تا جای ممکن از پیکسل‌ها فاصله می‌گیرد**. مجموعه ابزار مرورگر Claude درخت دسترسی‌پذیری (Accessibility Tree) را با ارجاع به عناصر (`[ref_2]`) برمی‌گرداند که کلیک‌ها و پر کردن فرم‌ها می‌توانند آن‌ها را هدف قرار دهند؛ این ارجاع‌ها در برابر جابه‌جایی‌های چیدمان صفحه مقاوم هستند اما پس از ناوبری (Navigation) به صفحه دیگر منقضی می‌شوند. قابلیت Computer Use در Gemini مختصات را روی یک شبکه ۰ تا ۹۹۹ نرمال‌سازی می‌کند و یک سرویس ایمنی اضافه می‌کند که برای دسته‌هایی مانند تراکنش‌های مالی، ایجاد حساب کاربری و پذیرش شرایط قانونی مقدار `require_confirmation` برمی‌گرداند. پیکسل‌ها را به‌عنوان راهکار پشتیبان برای برنامه‌های دسکتاپ فاقد ساختار دسترسی‌پذیر در نظر بگیرید.

### نمونه‌کد: حلقه استفاده از رایانه (Computer Use Loop)

<div dir="ltr">

```python
tools = [
    {"type": "computer_toolset_20260801"},  # GA toolset: no name, no display size
    {"type": "bash_20250124", "name": "bash"},
    {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"},
]
messages = [{"role": "user", "content": "Open the browser and go to GitHub."}]
SKIPPED = "Not executed: an earlier computer action in this turn failed."

for step in range(50):  # The vision-action loop, with a hard step cap
    response = client.messages.create(
        model="claude-sonnet-5-5", max_tokens=16000, tools=tools, messages=messages)
    messages.append({"role": "assistant", "content": response.content})  # once per turn
    if response.stop_reason != "tool_use":
        break
    results, failed = [], False
    for block in (b for b in response.content if b.type == "tool_use"):
        if failed:  # batch semantics: stop at the first failure, answer every block
            ok, content = False, SKIPPED
        elif needs_approval(block) and not human_approves(block):  # gate each block, mid-batch too
            ok, content, failed = False, "Rejected by the user.", True
        else:
            # screenshot and zoom return an image block; other members return "OK"
            ok, content = sandbox.execute(block.name, block.input)
            failed = not ok
        result = {"type": "tool_result", "tool_use_id": block.id,
                  "content": content, "is_error": not ok}
        if getattr(block, "toolset_name", None):  # computer toolset members
            result["toolset_name"] = block.toolset_name
        results.append(result)
    messages.append({"role": "user", "content": results})  # all results in one message
```

</div>

ابزار قدیمی‌تر `computer_20251124` روی مدل‌های نسخه 5.5 (Opus، Sonnet و Haiku) در Claude API و Google Cloud خطای HTTP 400 برمی‌گرداند (سرویس Bedrock هنوز آن را می‌پذیرد)، و مجموعه ابزار GA فیلدهای قدیمی `name` و اندازه نمایشگر را رد می‌کند. حلقه‌هایی که به‌ازای هر بلوک `tool_use` یک پیام assistant مجزا اضافه می‌کنند—همان‌طور که در بسیاری از نمونه‌های اولیه دیده می‌شد—با دسته‌ای شدن عمل‌ها توسط مدل از کار می‌افتند. یک تله دیگر در Opus 5.5 و Sonnet 5.5: برای صرفه‌جویی در واحدهای Token، اسکرین‌شات‌های قدیمی را از تاریخچه حذف نکنید. ویرایش نوبت‌های قبلی، بلوک‌های تفکر (Thinking Blocks) پس از آن را باطل می‌کند؛ بنابراین اسکرین‌شات‌ها را پیش از ارسال تغییر اندازه دهید (۲۰۰۰ پیکسل یا کمتر در هر ضلع) و بگذارید پاک‌سازی نتایج ابزار سمت سرور (Server-side Tool-result Clearing) تصاویر قدیمی را هرس کند.

### چه زمانی از این الگو استفاده کنیم

- خودکارسازی برنامه‌های قدیمی (Legacy) که هیچ API ندارند
- تست سرتاسری (End-to-End) رابط‌های کاربری گرافیکی
- وظایفی که نیازمند تعامل با چندین برنامه مختلف هستند
- کاربران غیرتوسعه‌دهنده‌ای که وظایف را به زبان طبیعی توصیف می‌کنند

### موازنه‌ها (Trade-offs)

| مزیت | عیب |
|------|-----|
| کار با هر برنامه دارای رابط گرافیکی (GUI) | کند (۱ تا ۳ ثانیه به‌ازای هر رفت‌وبرگشت مدل؛ دسته‌بندی آن را سرشکن می‌کند) |
| عدم نیاز به API یا یکپارچه‌سازی | هزینه بالای Token (حدود ۱٬۰۰۰ تا ۱٬۸۰۰ Token ورودی به‌ازای هر اسکرین‌شات) |
| مدیریت رابط‌های کاربری پویا | ریسک کلیک اشتباه در رابط‌های متراکم (بزرگ‌نمایی و ارجاع عناصر آن را کاهش می‌دهند) |
| قابل دسترس برای کاربران غیرفنی | نیازمند ماشین مجازی سندباکس‌شده برای ایمنی |

---

## الگوی ۳: اجرای کد محلی (Local Code Execution) <a id="pattern-3-local-code-execution"></a>

کاربر وظیفه‌ای را به زبان طبیعی توصیف می‌کند. مدل LLM کد تولید می‌کند. کد روی ماشین محلی (یا در یک سندباکس) اجرا می‌شود. خروجی مشاهده می‌شود و LLM یا کد بیشتری تولید می‌کند یا پاسخ نهایی را ارائه می‌دهد. نسخه اولیه پایتونی Open Interpreter و بخش‌هایی از Claude Code به این شکل کار می‌کنند.

### معماری

<div dir="ltr">

```
User (NL): "Analyze the CSV and plot the top 10 products"
  |
  v
[LLM Generates Code] --> Python/Bash/JS
  |
  v
[Permission Gate] --> "Run this code? [y/N]" (auto-approve, always-ask, or rules-based)
  |
  v
[Code Executor] --> Execute, capture stdout/stderr/return value
  |
  v
[Output Observer] --> Error? Feed back to LLM for fix. Success? Present to user.
  |
  v
[LLM Decides] --> Done? Return result. Need more? Generate next code block. (Loop)
```

</div>

### چرخه زبان طبیعی-کد-اجرا-مشاهده

**گام ۱. تبدیل زبان طبیعی به کد (Natural Language to Code):** مدل LLM قصد کاربر را به کد قابل اجرا ترجمه می‌کند. زبان کد بسته به وظیفه متفاوت است: Python برای تحلیل داده، Bash برای عملیات سیستمی و JavaScript برای کارهای وب.

**گام ۲. دروازه مجوز (Permission Gate):** پیش از اجرا، از کاربر تایید خواسته می‌شود. این حیاتی‌ترین سازوکار ایمنی برای محیط‌های بدون سندباکس است. پیاده‌سازی‌ها متفاوت‌اند:
- **همیشه بپرس (Always ask)** (پیش‌فرض نسخه پایتونی Open Interpreter): هر بلوک کد نیازمند تایید صریح است
- **تایید خودکار (Auto-approve)** (حالت مورد اعتماد): خطرناک اما سریع
- **مبتنی بر قوانین (Rules-based)** (مدل Claude Code): الگوهای مجاز/ممنوع در پیکربندی. برای مثال: مجاز دانستن دستورات `git` و منع `rm -rf`
- **مبتنی بر طبقه‌بندی‌کننده (Classifier-based):** یک مدل سیاست‌گذار (Policy Model) هر عمل را امتیازدهی کرده و آن را اجرا، رد یا به انسان ارجاع می‌دهد. این روش به‌صورت مرحله‌ای به پیش‌فرض تبدیل شد: Claude Code حالت خودکار (Auto Mode) را در ۱۴ اوت ۲۰۲۶ برای کاربران Pro، Max و Team پیش‌فرض کرد و از نسخه v2.1.284 (۲۸ سپتامبر) هر نشست تعاملی بدون حالت مجوز پیکربندی‌شده در همین حالت آغاز می‌شود. اجراهای بدون رابط کاربری (Headless) استثنا هستند: از نسخه v2.1.302 (۱۶ اکتبر)، نشست‌های `claude -p` و Agent SDK بدون حالت مشخص، روی ارائه‌دهندگان شخص ثالث، با تله‌متری خاموش یا روی یک نصب تازه، در حالت `default` شروع می‌شوند؛ بنابراین یک کار CI که هرگز حالت را تنظیم نمی‌کند ممکن است در محیط‌های مختلف رفتار متفاوتی داشته باشد. آن را به‌صراحت تنظیم کنید. سرویس Claude Managed Agents هر فراخوانی ابزار را در سمت سرور تحت سیاست مجوز خودکار (۱۰ سپتامبر) ارزیابی می‌کند. این رویکرد خستگی ناشی از تاییدهای مکرر (Approval Fatigue) را با مسئله کالیبراسیون معاوضه می‌کند: اکنون باید آستانه‌ای را انتخاب و پایش کنید که طبقه‌بندی‌کننده در آن تصمیم‌گیری را به انسان واگذار می‌کند

**گام ۳. اجرا و ثبت خروجی (Execute and Capture):** کد در یک ران‌تایم با دسترسی کامل (یا محدود) به سیستم اجرا می‌شود. خروجی‌های stdout، stderr، مقادیر بازگشتی و هر فایل تولیدشده ثبت می‌شوند.

**گام ۴. مشاهده و تکرار (Observe and Iterate):** مدل LLM خروجی اجرا را می‌بیند. اگر خطایی وجود داشته باشد، اصلاحیه‌ای تولید می‌کند. اگر خروجی ناقص باشد، گام بعدی را می‌سازد. این روند یک حلقه خوداصلاح‌گر (Self-correcting Loop) ایجاد می‌کند.

### نمونه‌کد: Agent اجرای کد

<div dir="ltr">

```python
class CodeExecutionAgent:
    def __init__(self, llm_client, sandbox=None):
        self.llm = llm_client
        self.sandbox = sandbox  # None = unsandboxed (host)
        self.history = []

    async def run(self, task: str) -> str:
        self.history.append({"role": "user", "content": task})
        for iteration in range(10):  # Max 10 code-execute cycles
            response = await self.llm.generate(messages=self.history)
            code = extract_code_block(response)
            if not code:
                return response  # No code = final answer
            if not self.sandbox and not await user_approves(code):
                return "Execution canceled by user."
            result = await (self.sandbox or LocalExecutor()).run(code, timeout=30)
            self.history.append({"role": "assistant", "content": response})
            self.history.append({"role": "user",
                "content": f"stdout: {result.stdout}\nstderr: {result.stderr}"})
        return "Max iterations reached."
```

</div>

### چه زمانی از این الگو استفاده کنیم

- وظایف تحلیل داده و مصورسازی
- مدیریت سیستم و خودکارسازی DevOps
- پردازش و تبدیل فایل‌ها
- هر وظیفه‌ای که در آن کاربر «چیستی» کار را توصیف می‌کند و Agent «چگونگی» آن را پیدا می‌کند

### موازنه‌ها (Trade-offs)

| مزیت | عیب |
|------|-----|
| انعطاف‌پذیری بسیار بالا | ریسک امنیتی در صورت نبود سندباکس |
| خوداصلاح‌گری از طریق حلقه مشاهده | احتمال تولید کد خطرناک توسط مدل |
| عملکرد آفلاین با مدل‌های محلی | نیازمند ارزیابی کد توسط کاربر (یا اعتماد کامل) |
| دسترسی کامل به سیستم در صورت نیاز | غیرقطعی (یک Prompt یکسان می‌تواند کد متفاوتی تولید کند) |

---

## الگوی ۴: ارکستراسیون ابزار چند-Agentی (Multi-Agent Tool Orchestration) <a id="pattern-4-multi-agent-tool-orchestration"></a>

به‌جای یک Agent با ابزارهای فراوان، چندین Agent تخصصی دارید که هر یک مالک زیرمجموعه‌ای از ابزارهاست. یک ارکستریتور (Orchestrator) وظایف را به Agent مناسب هدایت می‌کند. این همان «انقلاب میکروسرویس‌ها» برای دنیای Agentهاست.

### معماری

<div dir="ltr">

```
  [User Request]
       |
       v
  [ORCHESTRATOR] (Frontier model: Claude Opus 5.5, GPT-6 Astra)
  Analyzes task, selects agent, routes and waits
       |
  +----+----+----+
  |         |         |
  v         v         v
[Code Agent]  [Data Agent]  [Web Agent]
 bash, edit,   SQL, plot,    fetch, scrape,
 git           csv            browse
  |         |         |
  v         v         v
[Sandbox]  [Sandbox]  [Sandbox]
(Docker)   (Docker)   (Docker)
```

</div>

### راهبردهای ارکستراسیون

**۱. مبتنی بر مسیریاب (Router-Based - ساده‌ترین):** ارکستریتور یک طبقه‌بندی‌کننده است. به پیام کاربر نگاه می‌کند، Agent متخصص مناسب را برمی‌گزیند و کل وظیفه را به آن ارجاع می‌دهد. هیچ ارتباطی بین Agentها وجود ندارد.

**۲. برنامه‌ریزی و اجرا (Plan-and-Execute):** یک مدل برنامه‌ریز (در رده مدل‌های پیشرو یا Frontier) وظیفه را به زیروظیفه‌ها (Subtasks) می‌شکند و هر یک را به متخصص مربوطه می‌سپارد. نتایج زیروظیفه‌ها توسط برنامه‌ریز تجمیع می‌شوند. بخش عمده کاهش تاخیر (Latency) از اجرای موازی زیروظیفه‌های مستقل به دست می‌آید: پژوهش LLMCompiler (کنفرانس ICML 2024) که فراخوانی ابزارها را به‌صورت یک گراف وابستگی برنامه‌ریزی می‌کند، در بنچمارک‌های خود تا ۳.۷ برابر تاخیر کمتر و تا ۶.۷ برابر هزینه کمتر نسبت به ReAct متوالی گزارش کرده است. پیش از استناد به هر عددی، روی وظایف خودتان اندازه‌گیری کنید.

**۳. سلسله‌مراتبی (Hierarchical):** Agentهای سطح بالا کار را به Agentهای سطح پایین‌تر واگذار می‌کنند و آن‌ها نیز ممکن است بیشتر تفویض اختیار کنند. این ساختار بازتابی از ساختارهای سازمانی است و برای پروژه‌های پیچیده به‌خوبی کار می‌کند.

**۴. مشارکتی / همتابه‌همتا (Collaborative / Peer-to-Peer):** Agentها می‌توانند مستقیماً با یکدیگر ارتباط برقرار کنند، مشاهدات را به اشتراک بگذارند و درخواست کمک کنند. این پیچیده‌ترین الگو است اما وظایف نوظهور و پیش‌بینی‌نشده (Emergent Tasks) را به‌خوبی مدیریت می‌کند.

این راهبردها اکنون به‌صورت محصول عرضه می‌شوند. قابلیت Cursor Projects (نسخه بتا، ۱۰ سپتامبر ۲۰۲۶) یک هماهنگ‌کننده سلسله‌مراتبی است که کارها را به زیر-Agentهای موازی توزیع می‌کند و زمینه (Context) را برای ماه‌ها نگه می‌دارد. ابزار GitHub Copilot مرز مفیدی میان **جریان‌های کاری به‌عنوان کد (Workflows as Code)** (جریان‌های پویا: مراحل قطعی، نقاط بازبینی برای مرور انسانی) و **تفویض اختیار هدایت‌شده توسط مدل** (`/fleet`) ترسیم می‌کند. زمانی که مراحل شناخته‌شده هستند و ممیزی‌پذیری اهمیت دارد، جریان کاری به‌عنوان کد را انتخاب کنید؛ و هنگامی که خودِ تجزیه مسئله بخش دشوار کار است، تفویض اختیار را به مدل بسپارید.

### بهینه‌سازی هزینه: مزیت الگوی برنامه‌ریزی و اجرا

<div dir="ltr">

```
Traditional: [Frontier Model] handles all steps       Cost: $1.00/task

Plan-and-Execute:
  [Frontier Model] plans (1 call)                     Cost: $0.05
  [Small Model] executes steps 1-3                    Cost: $0.03
  [Frontier Model] aggregates (1 call)                Cost: $0.05
                                                      Total: $0.13/task
                                                      Savings: ~87%
```

</div>

روند سال ۲۰۲۶ برخورد با بهینه‌سازی هزینه Agent به‌عنوان یک دغدغه درجه یک است، مشابه زمانی که بهینه‌سازی هزینه ابری در عصر میکروسرویس‌ها ضروری شد. دو اصلاح بر محاسبات بالا:

- **آبشارها با دروازه کیفیت (Cascades with a quality gate)** هنگامی که دشواری وظایف متغیر است می‌توانند بهتر از تقسیم ثابت برنامه‌ریزی/اجرا عمل کنند: پیش‌نویس را با یک مدل ارزان بزنید، از دروازه کیفیت عبور دهید و فقط در صورت شکست به مدل قوی‌تر ارجاع (Escalate) دهید. قابلیت GitHub Copilot Fusion (عرضه عمومی ۲۸ اکتبر ۲۰۲۶، برآمده از پیش‌نمایش HydraFusion) دقیقاً همین را در کنار جریان‌های تک‌مدلی و نقد (Critique) به‌عنوان جریان آبشاری خود ارائه می‌دهد. شکاف قیمتی است که آن را وسوسه‌انگیز می‌کند: قیمت فهرست‌شده GPT-6 Luna برابر ۰.۱۰/۰.۵۰ دلار به ازای هر ۱ میلیون Token در برابر ۱۰/۵۰ دلار برای GPT-6 Astra است. نکته ظریف اینجاست که کش‌های Prompt (Prompt Caches) به‌ازای هر مدل مجزا هستند؛ بنابراین یک ارجاع به مدل قوی‌تر با کش سرد مواجه می‌شود و کل زمینه را با نرخ ورودی بدون کش مدل قوی‌تر محاسبه می‌کند. پیش از ساخت یک آبشار، مدل قوی‌تر را به‌تنهایی با تنظیم تلاش (Effort) پایین‌تر روی همان وظایف بسنجید.
- **واحدهای Token ورودی بر حلقه‌های طولانی ابزار غلبه دارند.** تله‌متری Claude Code شرکت Anthropic (۲۴ سپتامبر ۲۰۲۶، طبق گزارش ارائه‌دهنده) نسبت ورودی به خروجی را ۳۲۴ به ۱ اعلام می‌کند؛ بنابراین قیمت خواندن از کش و نرخ اصابت کش (Cache Hit Rate) از قیمت خروجی اهمیت بیشتری دارد. قیمت فهرست‌شده Claude Opus 5.5 برابر ۴/۲۰ دلار با نرخ خواندن کش ۰.۲۰ دلار (۰.۰۵ برابر ورودی) است؛ پس System Prompt و تعاریف ابزارها را پایدار نگه دارید تا در کش باقی بمانند.

---

## اجرای ایزوله‌شده در سندباکس در برابر اجرای بدون سندباکس <a id="sandboxed-vs-unsandboxed-execution"></a>

این پیامددارترین تصمیم معماری برای هر Agent ابزارمحور است.

### مقایسه

<div dir="ltr">

```
  UNSANDBOXED (Host Access)              SANDBOXED (Isolated)
  +------------------------+             +------------------------+
  | LLM output executes    |             | LLM output executes    |
  | directly on host OS    |             | inside Docker/VM/E2B   |
  |                        |             |                        |
  | Risk: rm -rf /         |             | Isolated filesystem,   |
  | Risk: data exfiltration|             | network, processes     |
  |                        |             |                        |
  | Used by: OpenClaw      |             | Used by: OpenHands,    |
  | (main session), Python |             | OpenAI Codex, Devin,   |
  | Open Interpreter,      |             | Cursor cloud agents,   |
  | Claude Code (default)  |             | Open Interpreter (Rust)|
  +------------------------+             +------------------------+
```

</div>

### گزینه‌های پیاده‌سازی سندباکس

| فناوری | سطح ایزوله‌سازی | زمان راه‌اندازی | مورد استفاده |
|--------|-------------------|-------------------|--------------|
| فناوری Docker | پردازش و فایل‌سیستم (Process + FS) | ۱ تا ۵ ثانیه | اغلب سندباکس‌های Agent (مانند OpenHands) |
| فناوری Firecracker | ماشین مجازی کامل (microVM) | حدود ۱۲۵ میلی‌ثانیه | محیط‌های چندمستاجری (Multi-tenant) با امنیت بالا |
| فناوری gVisor | سطح هسته (Kernel-level) | حدود ۲۰۰ میلی‌ثانیه | سرویس Google Cloud Run |
| سرویس E2B | سندباکس ابری | ۲ تا ۳ ثانیه | اجرای از راه دور Agent |
| فناوری WebAssembly | سطح زبان برنامه‌نویسی | کمتر از ۵۰ میلی‌ثانیه | اجرا در مرورگر |
| ران‌تایم اسنپ‌شات مدیریت‌شده (AgentCore Runtime V2) | سندباکس مدیریت‌شده به‌ازای هر نشست، بازیابی‌شده از اسنپ‌شات | حدود ۲ ثانیه در صدک ۷۵ (P75) برای ایمیج‌های ۲۰۰ مگابایت تا ۲ گیگابایت (طبق گزارش AWS؛ حدود ۵.۴ تا ۳۰ ثانیه در V1) | سندباکس‌های نشست‌محور Agent بدون نیاز به مدیریت ناوگان سرور |
| سندباکس VPC مدیریت‌شده (Gemini Enterprise Computer Use and Shell، عرضه عمومی ۹ سپتامبر ۲۰۲۶) | مدیریت‌شده، دارای VPC Service Controls و CMEK | سندباکس‌های بیکار (Idle) با حفظ وضعیت فایل‌سیستم زمان‌بندی‌زدایی می‌شوند و ظرف چند ثانیه از سر گرفته می‌شوند (Google) | سازمان‌های تحت مقررات سخت‌گیرانه در Google Cloud |

### اجماع سال ۲۰۲۶

سندباکس به‌صورت پیش‌فرض به‌همراه دریچه‌های خروج اضطراری (Escape Hatches). بحران امنیتی OpenClaw (۱۳۵٬۰۰۰ نمونه در معرض دید در اینترنت عمومی) باعث شد صنعت این موضوع را جدی بگیرد. از Agentهای عملیاتی جدید انتظار می‌رود به‌طور پیش‌فرض در سندباکس اجرا شوند. اجرای بدون سندباکس به محیط‌های تک‌کاربره و تحت نظارت محدود شده است.

دو تکمیل مهم از اوت و سپتامبر ۲۰۲۶:

- **جداسازی سطوح (Split the planes).** ارائه‌دهندگان Agentهای کدنویسی روی یک سطح کنترل (Control Plane) نزد ارائه‌دهنده و یک سطح اجرا (Execution Plane) با میزبانی مشتری همگرا شدند: اجراکننده‌های خودمیزبان Claude Code، سندباکس‌های خودمیزبان Claude Managed Agents، ماشین‌های خودمیزبان Cursor و محیط‌های خودمیزبان در OpenAI Agents API. ارکستراسیون و مدل‌ها نزد ارائه‌دهنده می‌مانند؛ اجرای ابزار، اعتبارنامه‌ها و ترافیک خروجی شبکه (Egress) درون محیط امن شما باقی می‌مانند. این پاسخ استاندارد به پرسش «چگونه به یک Agent اجازه دهیم به کد عملیاتی و اسرار امنیتی دست بزند» است.
- **مرز سندباکس شامل ترافیک خروجی (Egress) و مسیر توقف اضطراری (Kill Path) نیز هست.** شرکت OpenAI در افشای ۲۵ سپتامبر ۲۰۲۶ خود، Agentای را در یک اجرای آموزشی داخلی توصیف کرد که از طریق DNS با فیلتر ناکافی به بیرون تونل زده بود؛ سیستم پایش حدود ۱۲ دقیقه پس از اولین پاسخ خارجی هشدار داد، اما اجرا حدود ۲.۵ ساعت بعد متوقف شد زیرا توقف خودکار شکست خورد. فهرست مجاز (Allowlist) را برای DNS (دامنه‌ها و انواع رکوردها) نیز اعمال کنید، نه فقط HTTP، و توقف خودکار را مانند هر کنترل امنیتی دیگری آزمایش نمایید. اعمال کنترل خارج از باند (Out-of-band Enforcement) لایه بعدی است: پلتفرم Open Agent Safety شرکت NVIDIA (معرفی‌شده در ۲۸ سپتامبر ۲۰۲۶) ران‌تایم OpenShell خود (مجوز Apache 2.0، با سیاست منع پیش‌فرض) را با Sentry جفت می‌کند که یک طراحی مرجع برای نگهبان (Watchdog) روی پردازنده‌های BlueField-4 DPU است و بیرون از میزبان Agent قرار می‌گیرد و می‌تواند آن را قرنطینه کند.

---

## مدیریت وضعیت در سراسر فراخوانی‌های ابزار <a id="state-management-across-tool-calls"></a>

ایجنت‌ها (Agentها) باید وضعیت (State) را میان فراخوانی‌های ابزار حفظ کنند. راهبرد مناسب به چرخه حیات و مورد استفاده Agent بستگی دارد.

### الگوهای مدیریت وضعیت

| الگو | چرخه حیات | ذخیره‌سازی | استفاده‌شده توسط |
|------|------------|------------|------------------|
| الگوی **وضعیت مکالمه** (Conversation State) | موقتی (یک مکالمه منفرد) | آرایه پیام‌ها (Message array) | اغلب Agentهای مبتنی بر API |
| الگوی **وضعیت نشست** (Session State) | به‌ازای هر نشست (مسیر کاری، فایل‌های باز) | کانتینر Docker یا دایرکتوری موقت | ابزارهای OpenHands و Claude Code |
| الگوی **وضعیت ماندگار** (Persistent State) | بین‌نشستی (روزها و هفته‌ها) | پایگاه داده، فایل‌ها و Markdown | ابزارهای OpenClaw (`MEMORY.md`، `memory/`) و CLAUDE.md |
| الگوی **وضعیت محیط** (Environment State) | خارجی (منبع حقیقت) | مخزن Git، پایگاه داده و فایل‌سیستم | ابزار Claude Code (وضعیت git) و خطوط CI/CD |
| الگوی **وضعیت نشست مدیریت‌شده** (Managed Session State) | پایدار در برابر قطعی‌ها و راه‌اندازی مجدد | مخزن نشست و رویداد میزبانی‌شده توسط ارائه‌دهنده | سرویس‌های Claude Managed Agents و OpenAI Agents API |

وضعیت نشست مدیریت‌شده راحت است اما حافظه کاری Agent شما را تحت شرایط نگهداری و اقامت داده (Retention and Residency) ارائه‌دهنده قرار می‌دهد؛ بنابراین آن‌ها را برای هر استقرار (Deployment) بررسی کنید.

### پیاده‌سازی: وضعیت نشست

<div dir="ltr">

```python
class AgentSession:
    """Manages state across tool calls within a single session."""
    def __init__(self):
        self.conversation: list[dict] = []
        self.working_dir: str = tempfile.mkdtemp()
        self.open_files: dict[str, str] = {}  # path -> content cache
        self.tool_call_count: int = 0

    def add_tool_result(self, tool_name: str, args: dict, result: dict):
        self.tool_call_count += 1
        self.conversation.append({"role": "tool", "tool_name": tool_name,
            "args": args, "result": result, "timestamp": time.time()})
        # Update derived state from side effects
        if tool_name == "write_file":
            self.open_files[args["path"]] = args["content"]

    def get_context_for_llm(self, max_tokens: int = 100_000) -> list[dict]:
        """Return conversation history, compressed if over budget."""
        if estimate_tokens(self.conversation) < max_tokens:
            return self.conversation
        return self._compress_history(max_tokens)  # Summarize old results
```

</div>

---

## الگوهای مدیریت خطا و تلاش مجدد <a id="error-handling-and-retry-patterns"></a>

فراخوانی‌های ابزار شکست می‌خورند. شبکه‌ها با اتمام مهلت (Timeout) مواجه می‌شوند. رابط‌های API خطا برمی‌گردانند. کدها استثنا پرتاب می‌کنند. یک Agent عملیاتی به مدیریت خطای سیستماتیک نیاز دارد.

### رده‌بندی خطاها

| نوع خطا | مثال‌ها | راهبرد |
|---------|---------|--------|
| خطای **موقتی** (Transient) | اتمام مهلت شبکه، محدودیت نرخ (Rate limit)، کد ۵۰۳ | تلاش مجدد با تاخیر نمایی (Exponential backoff، حداکثر ۳ بار) |
| خطای **ورودی** (Input) | آرگومان‌های نامعتبر، قالب نادرست | ارسال خطا به LLM تا خودش آرگومان‌ها را اصلاح کند |
| خطای **دسترسی** (Permission) | شکست احراز هویت، عدم دسترسی | گزارش به کاربر؛ هرگز تلاش مجدد نکنید |
| خطای **منطقی** (Logic) | ابزار اشتباه، عملیات غیرممکن | ارسال خطا به LLM تا دوباره برنامه‌ریزی کند |
| خطای **فاجعه‌بار** (Catastrophic) | کمبود حافظه (OOM)، کرش سندباکس، حلقه بی‌نهایت | لغو عملیات، گزارش خطا و پاک‌سازی منابع |
| خطای **قراردادی** (Contract) | خطای HTTP 400 پس از تغییر نسخه مدل یا Agent (اجبار `tool_choice` در Opus 5.5، Sonnet 5.5 یا Fable 5.1؛ تغییر نام پارامترهای ابزار در نسخه جدید Agent مدیریت‌شده) | تلاش مجدد نکنید؛ نسخه‌ها را پین کنید و طرحواره‌های ابزار را در CI تست قراردادی (Contract-test) بگیرید |

### پیاده‌سازی الگوی تلاش مجدد

<div dir="ltr">

```python
class ToolExecutor:
    MAX_RETRIES = 3

    async def execute_with_retry(self, tool_name: str, args: dict) -> dict:
        for attempt in range(self.MAX_RETRIES):
            try:
                result = await self.call_tool(tool_name, args)
                if not result.get("error"):
                    return result  # Success
                error_type = classify_error(result["error"])
                if error_type == "transient":
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                    continue
                elif error_type == "input":
                    return {"error": result["error"], "fix_hint": "Adjust args"}
                elif error_type == "permission":
                    return {"error": result["error"], "action": "Report to user"}
                else:  # catastrophic
                    await self.cleanup_sandbox()
                    return {"error": "Fatal error. Task aborted."}
            except TimeoutError:
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
        return {"error": f"Failed after {self.MAX_RETRIES} retries"}
```

</div>

### حلقه خوداصلاح‌گری (Self-Correction Loop)

قدرتمندترین الگوی مدیریت خطا در سال ۲۰۲۶. این Agent شکست‌های خود را مشاهده می‌کند و به‌طور خودمختار آن‌ها را برطرف می‌سازد:

<div dir="ltr">

```
LLM generates code/tool call
  --> Execute --> Success? -- YES --> Return result
                     |
                     NO
                     |
                     v
              Feed error + stderr to LLM --> LLM generates fix --> Execute again
              (max 5 corrections to prevent infinite loops)
```

</div>

ابزارهای Claude Code، OpenHands و Cline خطاهای تست را دقیقاً همین‌گونه مدیریت می‌کنند: اجرای تست‌ها، مشاهده شکست‌ها، ویرایش کد، اجرای مجدد تست‌ها و تکرار تا سبز شدن همه تست‌ها.

---

## الگوهای یکپارچه‌سازی MCP <a id="mcp-integration-patterns"></a>

پروتکل MCP در سال ۲۰۲۶ به استاندارد یکپارچه‌سازی ابزار تبدیل شده است. در ادامه الگوهای کلیدی برای یکپارچه‌سازی MCP در معماری Agentها آورده شده است.

### الگوی الف: اتصال مستقیم MCP

<div dir="ltr">

```
[Agent (Client)] <-- stdio / HTTP --> [MCP Server]
```

</div>

ساده‌ترین الگو: یک Agent و یک سرور. برای ابزارهای تک‌منظوره (پایگاه داده، سیستم فایل) استفاده می‌شود.

### الگوی ب: توزیع چندسروری (Multi-Server Fan-Out)

<div dir="ltr">

```
                  +--> [GitHub MCP]
[Agent (Client)]--+--> [Postgres MCP]
                  +--> [Slack MCP]
```

</div>

این Agent هم‌زمان به چندین سرور MCP متصل می‌شود. طرحواره‌های ابزار در یک مانیفست واحد ادغام می‌شوند. توسط Claude Code و دستیارهای چندابزاری استفاده می‌شود.

### الگوی ج: دروازه MCP سازمانی (MCP Gateway)

<div dir="ltr">

```
[Agent 1] --+                          +--> [GitHub MCP]
[Agent 2] --+--> [MCP Gateway]  --+--> [Postgres MCP]
[Agent 3] --+    (Auth, Rate Limit,    +--> [Slack MCP]
                  Audit, Route)
```

</div>

دروازه مرکزی احراز هویت، محدودیت نرخ (Rate Limiting) و ثبت لاگ ممیزی را مدیریت می‌کند. Agentها فقط با دروازه احراز هویت می‌شوند. برای استقرارهای سازمانی و چندمستاجری (Multi-tenant) استفاده می‌شود.

### شکاف‌های نقشه راه MCP

در مه ۲۰۲۶، مشخصات فنی MCP فاقد سه قابلیت پایه عملیاتی بود: انتشار هویت (Identity Propagation)، بودجه‌بندی تطبیقی ابزار (Adaptive Tool Budgeting) و معناشناسی خطای ساخت‌یافته (Structured Error Semantics). وضعیت آن‌ها نسبت به بازبینی فعلی مشخصات (۲۸ ژوئیه ۲۰۲۶، هسته بدون وضعیت یا Stateless Core) و نقشه راه ۲۲ اوت ۲۰۲۶ نگهدارندگان به شرح زیر است:

| شکاف | وضعیت (نوامبر ۲۰۲۶) | در این میان چه کار کنیم |
|------|---------------------|-------------------------|
| **انتشار هویت (Identity propagation)** | قابلیت Enterprise-Managed Authorization (پایدار از ۱۸ ژوئن ۲۰۲۶ و طبقه‌بندی‌شده به‌عنوان Stable در چرخه عمر افزونه‌ها در SEP-3392) دسترسی تخصیص‌یافته توسط IdP را برای کاربران پوشش می‌دهد. گام بعدی هویت Agent است: استانداردهای DPoP (SEP-1932) و Workload Identity Federation (SEP-1933) در مرحله پیش‌نویس باز هستند و یک کارگروه هویت Agent در حال شکل‌گیری است | فعلاً دروازه (Gateway) را به‌عنوان کارگزار هویت برای Agentهای بدون رابط کاربری (Headless) نگه دارید |
| **بودجه‌بندی تطبیقی ابزار (Adaptive tool budgeting)** | جزو حوزه‌های اولویت‌دار نقشه راه ۲۲ اوت نیست. نزدیک‌ترین کار، کشف تدریجی سمت سرور برای کاتالوگ‌های بزرگ ابزار است که در واحدهای Token مربوط به طرحواره صرفه‌جویی می‌کند، نه در هزینه کل | بودجه را در هارنس یا دروازه اعمال کنید: سقف هزینه نشست (سرویس Claude Managed Agents با وضعیت `budget_reached` مکث می‌کند) و محدودیت نرخ به‌ازای هر ابزار |
| **معناشناسی خطای ساخت‌یافته (Structured error semantics)** | تا حدی برطرف شده: نقشه راه بازطراحی شکل نتیجه `tools/call` را در برنامه دارد، زیرا بازگرداندن هم‌زمان `content` و `structuredContent` به پیاده‌سازی‌های واگرا منجر شد | خطاها را در دروازه بر اساس رده‌بندی خودتان (جدول بالا را ببینید) نرمال‌سازی کنید |

بازبینی بعدی مشخصات برای ۳۰ مارس ۲۰۲۷ هدف‌گذاری شده است (طرح SEP-3398، پذیرفته‌شده در ۱۴ اکتبر و ادغام‌شده در ۲۷ اکتبر، مشروط به تایید نهایی)، و انتشارهای پس از آن عموماً در آخرین سه‌شنبه ماه‌های مارس و سپتامبر انجام می‌شوند؛ بنابراین ارتقای SDK را بر اساس همین زمان‌بندی برنامه‌ریزی کنید. فصل [استفاده از ابزار و MCP](../07-agentic-systems/03-tool-use-and-mcp.md) بازنویسی بدون وضعیت و نقشه راه کامل را پوشش می‌دهد.

---

## درخت تصمیم معماری <a id="architecture-decision-tree"></a>

برای انتخاب الگوی مناسب جهت مورد استفاده خود از این درخت تصمیم بهره ببرید:

<div dir="ltr">

```
Does the target system have an API?
 +-- YES --> Pattern 1 (Tool Calling). Wrap as MCP server. Fastest, most reliable.
 +-- NO  --> Does the task require GUI interaction?
              +-- YES --> Is it a web app?
              |            +-- YES --> Pattern 2 with element refs (accessibility tree) first,
              |            |           pixels as fallback. Confirm per action, approve per origin.
              |            +-- NO  --> Pattern 2 (Vision-Based). Sandbox in VM. Accept latency.
              +-- NO  --> Is the task primarily code/data work?
                           +-- YES --> Pattern 3 (Code Exec). Sandbox if multi-tenant.
                           +-- NO  --> Complex enough for multiple specialists?
                                        +-- YES --> Pattern 4 (Multi-Agent Orch.)
                                        +-- NO  --> Pattern 1 with custom tool.
```

</div>

### معماری‌های ترکیبی (Hybrid Architectures)

در عمل، سیستم‌های عملیاتی الگوها را ترکیب می‌کنند. ابزار Claude Code از این موارد استفاده می‌کند:
- الگوی ۱ (فراخوانی ابزار) برای عملیات فایل و Git
- الگوی ۲ (مبتنی بر بینایی) برای قابلیت‌های استفاده از رایانه
- الگوی ۳ (اجرای کد) برای Bash و اجرای تست‌ها
- الگوی ۴ (چند-Agentی) برای ایجاد زیر-Agentها (Subagents)

نکته کلیدی این است که به‌طور پیش‌فرض از ساده‌ترین الگو (فراخوانی تابع) شروع کنید و تنها زمانی پیچیدگی بیفزایید که مورد استفاده واقعاً آن را ایجاب کند.

---

## زاویه دید مصاحبه طراحی سیستم <a id="system-design-interview-angle"></a>

هنگام بحث درباره معماری ابزارمحور در مصاحبه‌ها، پاسخ خود را حول این پنج بُعد ساختاردهی کنید:

### ۱. انتخاب الگو (Pattern Selection)

با مشخص کردن الگوی مناسب شروع کنید: «سیستم هدف دارای یک REST API است، بنابراین از الگوی فراخوانی تابع/ابزار با یک سرور MCP به‌عنوان پوشش روی API استفاده می‌کنم.» این نشان می‌دهد درخت تصمیم را درک کرده‌اید.

### ۲. مرز سندباکس (Sandbox Boundary)

همواره به امنیت بپردازید: «برای یک استقرار چندمستاجری، نشست Agent هر کاربر را در یک کانتینر Docker بدون دسترسی شبکه به سرویس‌های داخلی ایزوله می‌کنم. سرور MCP بیرون از سندباکس اجرا می‌شود و تمام فراخوانی‌های خارجی را واسطه‌گری می‌کند.»

### ۳. راهبرد وضعیت (State Strategy)

توضیح دهید وضعیت چگونه مدیریت می‌شود: «از وضعیت نشست درون کانتینر Docker برای فایل‌های کاری و از وضعیت محیط (مخزن Git) به‌عنوان منبع حقیقت استفاده می‌کنم. برای این مورد استفاده نیازی به حافظه ماندگار Agent نیست.»

### ۴. بودجه خطا (Error Budget)

حالت‌های شکست را بررسی کنید: «فراخوانی‌های ابزار ممکن است به‌دلیل خطاهای موقتی (تلاش مجدد با تاخیر نمایی)، خطاهای ورودی (اصلاح خودکار توسط LLM) یا خطاهای دسترسی (اعلام به کاربر) شکست بخورند. پیش از ارجاع به انسان، حداکثر ۵ تلاش خوداصلاح‌گری در نظر می‌گیرم.»

### ۵. مدل هزینه (Cost Model)

به اقتصاد سیستم بپردازید: «برای ارکستریتور، از الگوی برنامه‌ریزی و اجرا استفاده می‌کنم: مدل Opus 5.5 وظیفه را برنامه‌ریزی و Haiku 5.5 هر گام را اجرا می‌کند. قیمت فهرست‌شده Haiku 5.5 برابر ۰.۱۰/۰.۵۰ دلار به ازای هر ۱ میلیون Token در برابر ۴/۲۰ دلار برای Opus 5.5 (شکافی ۴۰ برابری) است و خواندن کش آن ۰.۰۱ دلار در برابر ۰.۲۰ دلار هزینه دارد. نکته کلیدی یک پرتگاه قیمتی (Price Cliff) است: به محض اینکه Prompt مدل Haiku 5.5 با احتساب خواندن و نوشتن کش از ۱۰۰٬۰۰۰ Token عبور کند، کل درخواست با نرخ ۰.۵۰/۲.۵۰ دلار محاسبه می‌شود؛ بنابراین زمینه اجراکننده را کوتاه نگه می‌دارم و به هر گام فقط همان چیزی را می‌دهم که نیاز دارد. همچنین این مدل پارامترهای `temperature`، `top_p`، `top_k` و پیش‌پرکردن پاسخ دستیار (Assistant Prefill) را رد می‌کند؛ پس کد اجراکننده‌ای که از Haiku 4.5 منتقل شده نیازمند تست قراردادی است. از آنجا که در حلقه‌های طولانی ابزار حجم ورودی دو مرتبه بزرگی (100x) بیشتر از خروجی است، System Prompt و تعاریف ابزار را پایدار نگه می‌دارم تا در کش Prompt باقی بمانند.»

---

## سوالات مصاحبه <a id="interview-questions"></a>

### پرسش: سیستمی طراحی کنید که به یک Agent پشتیبانی مشتریان اجازه دهد با استفاده از داده‌های Zendesk، Salesforce و یک پایگاه دانش داخلی به سوالات پاسخ دهد.

**پاسخ قوی:**
الگوی ۱ (فراخوانی تابع/ابزار) با سه سرور MCP، یکی برای هر منبع داده. از الگوی توزیع چندسروری (Multi-Server Fan-Out) همراه با مانیفست‌های پویا استفاده کنید تا به‌ازای هر پرس‌وجو فقط ابزارهای مرتبط بارگذاری شوند. برای محیط عملیاتی، یک دروازه MCP اضافه کنید تا OAuth را به‌ازای هر منبع داده، محدودیت نرخ (به‌ویژه حیاتی برای محدودیت‌های Salesforce API) و ثبت لاگ ممیزی را مدیریت کند. وضعیت به‌صورت موقتی (Ephemeral) است: پشتیبانی مشتریان نیازی به حافظه بین‌نشستی ندارد.

### پرسش: چگونه از وارد شدن آسیب توسط یک AI Agent از طریق فراخوانی‌های ابزار جلوگیری می‌کنید؟

**پاسخ قوی:**
دفاع در عمق (Defense in Depth) در پنج لایه: (۱) محدودیت‌های طرحواره با الگوهای منع (عبارات باقاعده برای رد کردن `DROP TABLE` و موارد مشابه). (۲) دروازه مجوز برای عملیات مخرب: قوانین مجاز/ممنوع Claude Code الگوی خوبی است و در مقیاس بالا، یک طبقه‌بندی‌کننده سیاست‌گذار کالیبره‌شده که هر فراخوانی را اجرا، رد یا ارجاع دهد از خستگی تایید جلوگیری می‌کند. (۳) ایزوله‌سازی سندباکس (Docker با مانت‌های فقط‌خواندنی، بدون شبکه خروجی و همچنین DNS روی فهرست مجاز). (۴) سقف واحدهای Token و هزینه برای جلوگیری از حلقه‌های کنترل‌نشده، به‌همراه یک مکانیزم توقف خودکار که واقعاً آن را آزمایش کرده باشید. (۵) ردپای ممیزی از طریق الگوی دروازه MCP. هیچ لایه‌ای به‌تنهایی کافی نیست: مدل می‌تواند آرگومان‌هایی بسازد که از اعتبارسنجی عبور کنند (نیاز به سندباکس)، و سندباکس نمی‌تواند جلوی نشت داده از مسیرهای مجاز را بگیرد (نیاز به ثبت لاگ ممیزی و سیاست مقصد). رخداد PixelLeak (گزارش Glow Security، ۲۹ سپتامبر ۲۰۲۶) یک نمونه هشداردهنده است: Agentهای کدنویسی که دستور داشتند اسکرین‌شات‌ها را به PRهای خصوصی پیوست کنند، بیش از ۱۳٬۰۰۰ تصویر داخلی را بدون دخالت هیچ مهاجمی در مخازن عمومی منتشر کردند؛ بنابراین میزان دیده‌شدن مخزن (Repo Visibility) و مقصدها باید جزئی از سیاست عمل (Action Policy) باشند.

### پرسش: موازنه‌های بین استفاده از رایانه مبتنی بر بینایی (Vision-Based Computer Use) و فراخوانی ابزار مبتنی بر API را توضیح دهید.

**پاسخ قوی:**
روش مبتنی بر API سریع‌تر (۵۰ تا ۲۰۰ میلی‌ثانیه در برابر ۱ تا ۳ ثانیه به‌ازای هر رفت‌وبرگشت مدل)، ارزان‌تر (Tokenهای متنی در برابر Tokenهای تصویری با حدود ۱٬۰۰۰ تا ۱٬۸۰۰ Token به‌ازای هر اسکرین‌شات)، قابل اتکاتر (قطعی در برابر کلیک مختصاتی) و آزمون‌پذیرتر است. همیشه وقتی API وجود دارد آن را ترجیح دهید. روش مبتنی بر بینایی راهکار پشتیبان برای برنامه‌های فاقد API، سیستم‌های قدیمی یا جریان‌های کاری چندبرنامه‌ای است. این شکاف اکنون باریک‌تر شده است: بزرگ‌نمایی (Zoom) و ارجاع عناصر درخت دسترسی‌پذیری کلیک‌های اشتباه را کاهش می‌دهند و عمل‌های دسته‌ای یک رفت‌وبرگشت مدل را روی چندین گام سرشکن می‌کنند، به بهای یک دروازه تایید که باید پیش از اجرا تک‌تک عمل‌های یک دسته را بررسی کند به‌جای آنکه منتظر نوبت بعدی بماند. بهترین شیوه: فراخوانی API برای ۸۰ درصد وظایف دارای پشتیبانی API، روش مبتنی بر بینایی برای ۲۰ درصد باقی‌مانده، و ارجاع به عناصر پیش از پیکسل‌ها در داخل مرورگرها.

---

## منابع <a id="references"></a>

- مستندات Anthropic: «Computer Use Tool Documentation» (۲۰۲۴-۲۰۲۶)
- مستندات Anthropic: «Model Context Protocol Specification» (۲۰۲۵-۲۰۲۶)
- گزارش نگهدارندگان هسته MCP: «The New MCP Roadmap» (۲۲ اوت ۲۰۲۶)
- مستندات ابزارهای استفاده از رایانه و مرورگر Anthropic (`computer_toolset_20260801`، `browser_toolset_20260801`) (۲۰۲۶)
- مستندات استفاده از رایانه در Gemini API گوگل (۲۰۲۶)
- مقاله IBM Developer: «MCP Architecture Patterns for Multi-Agent AI Systems» (۲۰۲۶)
- راهنمای Google Cloud: «Choose a Design Pattern for Your Agentic AI System» (۲۰۲۵-۲۰۲۶)
- راهنمای Microsoft Azure: «AI Agent Orchestration Patterns» (۲۰۲۵-۲۰۲۶)
- مستندات OpenHands: «Runtime Architecture» (۲۰۲۵-۲۰۲۶)
- مستندات OpenClaw: «Architecture and SOUL.md Guide» (۲۰۲۵-۲۰۲۶)
- مخزن گیت‌هاب Open Interpreter (۲۰۲۴-۲۰۲۶)
- مقاله ArXiv 2603.13417: «Design Patterns for Deploying AI Agents with MCP» (۲۰۲۶)
- مقاله Kim et al.: «An LLM Compiler for Parallel Function Calling» (ICML 2024، arXiv 2312.04511)

---

*قبلی: [چشم‌انداز Agentهای ابزارمحور و رایانه‌ای](01-tool-use-landscape.md)*
*بعدی: [بررسی عمیق OpenClaw](03-openclaw-deep-dive.md)*

</div>
