# 🎓 دوره‌ها و مسیرهای یادگیری پیشنهادی AI

فهرستی دست‌چین‌شده از دوره‌های آنلاین **معتبر و قابل اعتماد** برای مهندسان AI، متخصصان ML و تیم‌های محصول، که بر اساس مفاهیمی با ماندگاری بالا انتخاب شده‌اند. بدون حاشیه، بدون دوره‌های آنلاین (MOOC) قدیمی و از رده خارج. ارائه‌دهندگان گاهی دوره‌ها را تغییر نام داده، منتقل کرده یا بازنشسته می‌کنند؛ بنابراین اگر پیوندی ریدایرکت شد، آن را تا نسخه فعلی ارائه‌دهنده دنبال کنید.

> **نکته‌ای درباره کهنگی کدها:** این دوره‌ها بر اساس *مفاهیم* پایه‌ای‌شان گلچین شده‌اند. APIهای فریم‌ورک‌هایی که استفاده می‌کنند (مانند LlamaIndex و LangChain) به سرعت تغییر می‌کنند، بنابراین کدهای نوت‌بوک در هر دوره ضبط‌شده‌ای ممکن است قدیمی شوند و در یک نصب جدید با خطا مواجه گردند. قبل از کپی-پیست کردن، بررسی ۳۰ ثانیه‌ای به‌روز بودن کد را در [مدیریت تغییرات مداوم فریم‌ورک‌ها (Navigating Framework Churn)](09-frameworks-and-tools/12-navigating-framework-churn.md) انجام دهید، و مفاهیم بنیادین (primitives) را بیاموزید، نه صرفاً مسیرهای import را.

---

## فهرست مطالب

- [مبانی: LLMها و ترنسفورمرها (Foundation: LLMs & Transformers)](#foundation)
- [پایپ‌لاین‌های RAG (RAG Pipelines)](#rag)
- [AI ایجنتی و سیستم‌های چند ایجنتی (Agentic AI & Multi-Agent Systems)](#agents)
- [مدیریت کانتکست و حافظه (Context & Memory Management)](#context-memory)
- [ارزیابی‌ها و مشاهده‌پذیری در AI (AI Evaluations & Observability)](#evals)
- [مهندسی Prompt و مهندسی کانتکست (Prompt Engineering & Context Engineering)](#prompting)
- [تنظیم دقیق (Fine-tuning) و سازگار‌سازی (Fine-tuning & Adaptation)](#finetuning)
- [بهینه‌سازی استنتاج (Inference) و MLOps (Inference Optimization & MLOps)](#mlops)
- [ایمنی AI و گاردریل‌ها (AI Safety & Guardrails)](#safety)
- [ایجنت‌های کدنویسی و ابزارهای توسعه‌دهنده AI (Coding Agents & Developer AI Tools)](#coding-agents)
- [برای مدیران محصول و افراد غیرفنی (For PMs & Non-Engineers)](#pm-track)
- [کانال‌های یوتیوب و محتوای رایگان (YouTube Channels & Free Content)](#free)
- [پیشنهادهای مسیر یادگیری (Learning Path Suggestions)](#paths)

---

## مبانی: LLMها و ترنسفورمرها (Foundation: LLMs & Transformers) <a name="foundation"></a>

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا قابل اعتماد است (Why It's Trusted) |
|--------|----------|------|-----------------|
| **[شبکه‌های عصبی: از صفر تا قهرمان (Neural Networks: Zero to Hero)](https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ)** | آندری کارپاتی (Andrej Karpathy) (یوتیوب) | رایگان (Free) | مجموعه آموزشی مرجع و بی‌نظیر برای یادگیری از پایه توسط یکی از اسطوره‌های OpenAI و تسلا. ساخت GPT از صفر (from scratch). |
| **[سی‌اس ۳۲۴: مدل‌های زبانی بزرگ (CS324: Large Language Models)](https://stanford-cs324.github.io/winter2022/)** | استنفورد (Stanford) | رایگان (Free) | جزوات درسی در سطح دانشگاه استنفورد که مبانی LLMها، قوانین مقیاس‌پذیری (scaling laws) و هم‌ترازی (alignment) را پوشش می‌دهند. |
| **[هوش مصنوعی زایشی با LLMها (Generative AI with LLMs)](https://www.coursera.org/learn/generative-ai-with-llms)** | DeepLearning.AI + AWS (Coursera) | حدود ۵۰ دلار (~$50) | مقدمه‌ای عملی و کاربردی بر LLMها، شامل آموزش (training)، تنظیم دقیق (Fine-tuning) و RLHF. تهیه‌شده توسط تیم اندرو ان‌جی (Andrew Ng). |
| **[یادگیری عمیق کاربردی برای کدنویسان (Practical Deep Learning for Coders)](https://course.fast.ai/)** | fast.ai | رایگان (Free) | رویکردی پایین به بالا و مبتنی بر کدنویسی. بهترین گزینه برای مهندسانی که با انجام دادن یاد می‌گیرند. |

---

## پایپ‌لاین‌های RAG (RAG Pipelines) <a name="rag"></a>

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا قابل اعتماد است (Why It's Trusted) |
|--------|----------|------|-----------------|
| **[ساخت و ارزیابی RAG پیشرفته (Building and Evaluating Advanced RAG)](https://www.deeplearning.ai/short-courses/building-evaluating-advanced-rag/)** | DeepLearning.AI + LlamaIndex | رایگان (Free) | بازیابی پنجره-جمله‌ای (sentence-window retrieval)، ادغام خودکار (auto-merging) و ارزیابی RAG با ابزار TruLens را پوشش می‌دهد. |
| **[پایگاه‌های داده برداری: از امبدینگ تا کاربردها (Vector Databases: from Embeddings to Applications)](https://www.deeplearning.ai/short-courses/vector-databases-embeddings-applications/)** | DeepLearning.AI + Weaviate | رایگان (Free) | راهنمای عملی و گام‌به‌گام درباره امبدینگ‌ها (embeddings)، پایگاه داده برداری (Vector Database) و جستجوی ترکیبی (hybrid search). |
| **[ساخت ایجنت‌های RAG با LLMها (Building RAG Agents with LLMs)](https://courses.nvidia.com/courses/course-v1:DLI+S-FX-15+V1/)** | مؤسسه یادگیری عمیق انویدیا (NVIDIA Deep Learning Institute) | رایگان (Free) | پیاده‌سازی RAG در سطح سازمانی با NVIDIA NIM. مفاهیم Chunking، بازرتبه‌بندی (reranking) و ارزیابی را پوشش می‌دهد. |
| **[لاما ایندکس: درک LlamaIndex (LlamaIndex: Understanding LlamaIndex)](https://developers.llamaindex.ai/python/framework/understanding/)** | LlamaIndex | رایگان (Free) | مسیر یادگیری رسمی LlamaIndex: آموزش‌های کوتاه درباره ایجنت‌ها، گردش کارها (workflows) و RAG، به همراه مشاهده‌پذیری و ارزیابی. بهترین منبع برای تسلط عمیق بر پایپ‌لاین‌های RAG. |
| **[مبانی RAG با هی‌استک (RAG Fundamentals (Haystack))](https://haystack.deepset.ai/tutorials)** | deepset / Haystack | رایگان (Free) | آموزش‌های عملی برای ساخت RAG مبتنی بر پایپ‌لاین با استفاده از فریم‌ورک Haystack. |

---

## فناوری AI ایجنتی و سیستم‌های چند ایجنتی (Agentic AI & Multi-Agent Systems) <a name="agents"></a>

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا قابل اعتماد است (Why It's Trusted) |
|--------|----------|------|-----------------|
| **[ایجنت‌های هوش مصنوعی در لانگ‌گراف (AI Agents in LangGraph)](https://www.deeplearning.ai/short-courses/ai-agents-in-langgraph/)** | DeepLearning.AI + LangChain | رایگان (Free) | آموزش LangGraph توسط سازندگان آن. مباحث ReAct، ماندگاری (persistence)، انسان در حلقه (human-in-the-loop) و سیستم‌های چند ایجنتی را پوشش می‌دهد. |
| **[سیستم‌های چند ایجنتی هوش مصنوعی با کرو ای‌آی (Multi AI Agent Systems with crewAI)](https://www.deeplearning.ai/short-courses/multi-ai-agent-systems-with-crewai/)** | DeepLearning.AI + crewAI | رایگان (Free) | دوره رسمی CrewAI. مفاهیم Crews ،Flows و اتوماسیون‌های کسب‌وکار در دنیای واقعی را پوشش می‌دهد. |
| **[ساخت RAG ایجنتی با لاما ایندکس (Building Agentic RAG with LlamaIndex)](https://www.deeplearning.ai/short-courses/building-agentic-rag-with-llamaindex/)** | DeepLearning.AI + LlamaIndex | رایگان (Free) | مسیریابی (routing)، ایجنت‌های فراخوانی ابزار (tool-calling agents) و بازیابی ایجنتی چندسندی (multi-document agentic retrieval). |
| **[توابع، ابزارها و ایجنت‌ها با لانگ‌چین (Functions, Tools and Agents with LangChain)](https://www.deeplearning.ai/short-courses/functions-tools-agents-langchain/)** | DeepLearning.AI + LangChain | رایگان (Free) | فراخوانی ابزار (tool-calling)، فراخوانی توابع OpenAI و ساخت از پایه (scratch). |
| **[الگوهای طراحی ایجنتی AI با اتوجن (AI Agentic Design Patterns with AutoGen)](https://www.deeplearning.ai/short-courses/ai-agentic-design-patterns-with-autogen/)** | DeepLearning.AI + Microsoft Research | رایگان (Free) | الگوهای چند ایجنتی: مناظره (debate)، استفاده از ابزار و ایجنت‌های اجرای کد. خود AutoGen اکنون در حالت نگهداری (maintenance mode) قرار دارد و فریم‌ورک Microsoft Agent Framework (نسخه GA در آوریل ۲۰۲۶) جایگزین آن شده است؛ بنابراین الگوها را بیاموزید، نه صرفاً API را. |
| **[سی‌اس ۲۹۴/۱۹۴-۱۹۶: ایجنت‌های مبتنی بر LLM در برکلی (CS294/194-196: LLM Agents (Berkeley))](https://rdi.berkeley.edu/llm-agents/f24)** | دانشگاه برکلی کالیفرنیا (UC Berkeley) | رایگان (Free) | دوره‌ای در سطح تحصیلات تکمیلی درباره ایجنت‌های مبتنی بر LLM. مباحث حافظه، برنامه‌ریزی (planning)، ایمنی و ارزیابی را پوشش می‌دهد. |
| **[مدرک دستیار پروتکل زمینه مدل (Model Context Protocol Associate (MCPA))](https://training.linuxfoundation.org/certification/model-context-protocol-associate-mcpa/)** | بنیاد لینوکس / بنیاد ایجنتی AI (Linux Foundation / Agentic AI Foundation) | ۲۵۰ دلار (آزمون) ($250 (exam)) | یک گواهینامه است، نه یک دوره آموزشی: آزمونی چندگزینه‌ای و نظارت‌شده (proctored) به مدت ۹۰ دقیقه که منطبق بر مشخصات MCP نسخه 2026-07-28 بوده و در ۱۴ سپتامبر ۲۰۲۶ راه‌اندازی شده است. امنیت و حاکمیت (governance) ۲۴٪ از آن را تشکیل می‌دهد. نشانه‌ای بی‌طرفانه نسبت به ارائه‌دهندگان (vendor-neutral) است، اما پروژه‌های عملی پیاده‌سازی‌شده با MCP همچنان ارزش و اعتبار بیشتری دارند. |

---

## مدیریت زمینه و حافظه (Context & Memory Management) <a name="context-memory"></a>

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا قابل اعتماد است (Why It's Trusted) |
|--------|----------|------|-----------------|
| **[ساخت سیستم‌ها با API چت‌جی‌پی‌تی (Building Systems with the ChatGPT API)](https://www.deeplearning.ai/short-courses/building-systems-with-chatgpt/)** | DeepLearning.AI + OpenAI | رایگان (Free) | وضعیت گفتگوی چندنوبته (multi-turn conversation state)، مدیریت زمینه (context) و زنجیره‌های تعدیل محتوا (moderation chains) را پوشش می‌دهد. |
| **[مهندسی Prompt با لاما ۲ (Prompt Engineering with Llama 2)](https://www.deeplearning.ai/short-courses/prompt-engineering-with-llama-2/)** | DeepLearning.AI + Meta | رایگان (Free) | بده‌بستان‌های پنجره کانتکست (context window tradeoffs) و مدیریت Prompt سیستم (system prompt) را با لاما ۲ نشان می‌دهد. |
| **[استدلال با مدل o1 (Reasoning with o1)](https://www.deeplearning.ai/short-courses/reasoning-with-o1/)** | DeepLearning.AI + OpenAI | رایگان (Free) | مهارت Promptنویسی (Prompting) و برنامه‌ریزی با مدل‌های استدلالی. هرچند خود مدل قدیمی‌تر از چیزی است که امروزه استقرار (Deployment) می‌دهید، اما ایده‌های آن مستقیماً با ابزارهای کنترلی تلاش استدلال (reasoning-effort controls) امروزی همخوانی دارند (`reasoning.effort` در OpenAI، و تفکر تطبیقی با تنظیمات effort در Claude). |
| **[مستندات Mem0 (Mem0 Documentation)](https://docs.mem0.ai/)** | پلتفرم Mem0 (رسمی) | رایگان (Free) | مرجع رسمی برای حافظه چندسطحی (multi-tier memory) در ایجنت‌های عملیاتی (production). نسخه 2.x پلتفرم Mem0 مدل نوشتن را تغییر داده است (حافظه‌ها از نسخه ۲.۰ به بعد صرفاً افزودنی یا add-only هستند) و در نسخه‌های فعلی درایورهای گراف حذف شده‌اند، بنابراین آموزش‌های قدیمی‌تر کارایی ندارند. |

---

## ارزیابی‌ها و مشاهده‌پذیری در AI (AI Evaluations & Observability) <a name="evals"></a>

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا قابل اعتماد است (Why It's Trusted) |
|--------|----------|------|-----------------|
| **[ارزیابی‌های AI برای مهندسان و مدیران محصول (AI Evals For Engineers & PMs)](https://maven.com/parlance-labs/evals)** | هامل حسین و شریا شانکار (Maven) (Hamel Husain & Shreya Shankar (Maven)) | غیررایگان (دوره‌ای) (Paid (cohort)) | استاندارد طلایی صنعت برای ارزیابی‌های AI. در محیط عملیاتی ده‌ها شرکت استفاده می‌شود. راهنماهای ارزیابی ریپازیتوری ما نیز بر اساس همین دوره تدوین شده‌اند. |
| **[ارزیابی و اشکال‌زدایی هوش مصنوعی زایشی (Evaluating and Debugging Generative AI)](https://www.deeplearning.ai/short-courses/evaluating-debugging-generative-ai/)** | DeepLearning.AI + W&B | رایگان (Free) | ردیابی (tracing)، ارزیابی با W&B Weave و ردگیری آزمایش‌ها (experiment tracking) را پوشش می‌دهد. |
| **[کیفیت و ایمنی برای برنامه‌های کاربردی LLM (Quality and Safety for LLM Applications)](https://www.deeplearning.ai/short-courses/quality-safety-llm-applications/)** | DeepLearning.AI + WhyLabs | رایگان (Free) | تشخیص توهم (hallucination detection)، سمیت (toxicity)، ارزیابی سوگیری (bias) و پایش انحراف (drift monitoring) را پوشش می‌دهد. |
| **[مفاهیم ارزیابی لانگ‌اسمیت (LangSmith Evaluation Concepts)](https://docs.langchain.com/langsmith/evaluation-concepts)** | LangChain | رایگان (Free) | مستندات رسمی LangSmith در صورتی که از زیست‌بوم LangChain استفاده می‌کنید، بهترین مرجع کاربردی ارزیابی است. ارزیابی‌های آفلاین و آنلاین را پوشش می‌دهد. |
| **[مستندات آریز فینیکس (Arize Phoenix Docs)](https://arize.com/docs/phoenix)** | Arize Phoenix | رایگان (Free) | آموزش‌های کاربردی برای ردیابی (tracing) و ارزیابی با Phoenix، که با مجوز Elastic License 2.0 به صورت سورس در دسترس (source-available) عرضه می‌شود. شرکت Dynatrace فرایند تصاحب Arize را در ۱ اکتبر ۲۰۲۶ تکمیل کرد و اعلام کرده که Phoenix همچنان در دسترس باقی خواهد ماند. |

> 📖 همچنین راهنماهای مکمل این ریپازیتوری را ببینید:
> - [ارزیابی‌های AI: راهنمای جامع مطالعه (Phoenix + Langfuse)](ai_evals_comprehensive_study_guide.md)
> - [ارزیابی‌های AI: راهنمای کامل LangWatch + Langfuse](ai_evals_complete_guide_langwatch_langfuse.md)

---

## مهندسی Prompt و مهندسی کانتکست (Prompt Engineering & Context Engineering) <a name="prompting"></a>

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا قابل اعتماد است (Why It's Trusted) |
|--------|----------|------|-----------------|
| **[مهندسی Prompt چت‌جی‌پی‌تی برای توسعه‌دهندگان (ChatGPT Prompt Engineering for Developers)](https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/)** | DeepLearning.AI + OpenAI | رایگان (Free) | دوره بنیادین مهندسی Prompt. تدریس شده توسط ایزا فولفورد (Isa Fulford) و اندرو ان‌جی (Andrew Ng). |
| **[آموزش تعاملی مهندسی Prompt (Interactive Prompt Engineering Tutorial)](https://github.com/anthropics/prompt-eng-interactive-tutorial)** | آنتروپیک (گیت‌هاب) (Anthropic (GitHub)) | رایگان (Free) | مستقیماً از سوی تیم Claude: نه فصل همراه با تمرینات عملی که ساختار Prompt، تگ‌های XML، جداسازی داده‌ها از دستورالعمل‌ها، نمونه‌ها و جلوگیری از توهم را پوشش می‌دهند. این دوره روی مدل قدیمی‌تر Claude اجرا می‌شود، اما تکنیک‌های آن کاملاً قابل انتقال و کاربردی هستند. |
| **[دی‌اس‌پای: ساخت پایپ‌لاین‌های بهینه‌پذیر (DSPy: Building Optimizable Pipelines)](https://github.com/stanfordnlp/dspy)** | Stanford NLP (GitHub) | رایگان (Free) | یک دوره آموزشی نیست، اما نوت‌بوک‌های مخزن DSPy بهترین راه برای یادگیری Promptنویسی برنامه‌نویسی‌شده (programmatic prompting) هستند. |
| **[راهنمای مهندسی Prompt (Prompt Engineering Guide)](https://www.promptingguide.ai/)** | DAIR.AI | رایگان (Free) | مرجعی جامع و نگهداری‌شده توسط جامعه کاربری که تمامی تکنیک‌های اصلی Promptنویسی را پوشش می‌دهد. |

---


## فرآیند Fine-tuning و سازگارسازی (Fine-tuning & Adaptation) <a name="finetuning"></a>

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا قابل اعتماد است (Why It's Trusted) |
|---|---|---|---|
| **[Fine-tuning مدل‌های زبانی بزرگ (Finetuning Large Language Models)](https://www.deeplearning.ai/short-courses/finetuning-large-language-models/)** | DeepLearning.AI + Lamini | رایگان (Free) | شامل مباحث LoRA، فرآیند کامل Fine-tuning، آماده‌سازی مجموعه داده و ارزیابی؛ مختصر و کاربردی. |
| **[یادگیری تقویتی از بازخورد انسانی (Reinforcement Learning from Human Feedback)](https://www.deeplearning.ai/short-courses/reinforcement-learning-from-human-feedback/)** | DeepLearning.AI + AWS | رایگان (Free) | بررسی عمیق RLHF: مدل‌های پاداش (reward models)، الگوریتم PPO و مجموعه‌های داده ترجیحات (preference datasets). |
| **[دوره LLM هاگینگ فیس (Hugging Face LLM Course)](https://huggingface.co/learn/llm-course/chapter1/1)** | Hugging Face | رایگان (Free) | نام قبلی: دوره NLP. بهترین دوره رایگان برای Fine-tuning مدل‌های ترنسفورمر با اکوسیستم HF (شامل Trainer، PEFT و غیره). |
| **[نحوه کارکرد مدل‌های انتشار (How Diffusion Models Work)](https://www.deeplearning.ai/short-courses/how-diffusion-models-work/)** | DeepLearning.AI | رایگان (Free) | برای Fine-tuning مدل‌های تصویری (Stable Diffusion و LoRA برای تصاویر). |

---

## بهینه‌سازی استنتاج (Inference) و MLOps <a name="mlops"></a>

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا قابل اعتماد است (Why It's Trusted) |
|---|---|---|---|
| **[یادگیری ماشین در محیط عملیاتی (Machine Learning in Production)](https://www.coursera.org/learn/introduction-to-machine-learning-in-production)** | DeepLearning.AI (Coursera) | پولی (Paid) | دوره اندرو ان‌جی (Andrew Ng) درباره چرخه حیات ML در محیط عملیاتی: الگوهای استقرار (Deployment)، مانیتورینگ و اصلاحات داده‌محور (data-centric). دوره تخصصی ۴ مرحله‌ای قدیمی MLOps اکنون به اینجا هدایت می‌شود. |
| **[سرویس‌دهی کارآمد LLMها (Efficiently Serving LLMs)](https://www.deeplearning.ai/short-courses/efficiently-serving-llms/)** | DeepLearning.AI + Predibase | رایگان (Free) | پوشش مباحث vLLM، الگوریتم PagedAttention، کوانتیزاسیون و سرویس‌دهی LoRA؛ دقیقاً همان مباحثی که این راهنما پوشش می‌دهد. |
| **[مستندات و آموزش vLLM (vLLM Documentation & Tutorial)](https://docs.vllm.ai/en/latest/)** | vLLM | رایگان (Free) | مستندات رسمی vLLM به‌روزترین مرجع برای سرویس‌دهی با توان عملیاتی (Throughput) بالا هستند. |

---

## ایمنی و گاردریل‌های هوش مصنوعی (AI Safety & Guardrails) <a name="safety"></a>

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا قابل اعتماد است (Why It's Trusted) |
|---|---|---|---|
| **[تیم قرمز برای برنامه‌های کاربردی LLM (Red Teaming LLM Applications)](https://www.deeplearning.ai/short-courses/red-teaming-llm-applications/)** | DeepLearning.AI + Giskard | رایگان (Free) | عملیات کاربردی تیم قرمز (red teaming)، تزریق Prompt (Prompt injection)، شناسایی جیل‌بریک (jailbreak) و ارزیابی سوگیری (bias testing). |
| **[هم‌راستاسازی هوش مصنوعی (AI Alignment)](https://bluedot.org/courses/alignment/)** | BlueDot Impact | رایگان (Free) | معتبرترین دوره رایگان در زمینه هم‌راستاسازی و ایمنی هوش مصنوعی (نام پیشین: مبانی ایمنی هوش مصنوعی). مورد استفاده متخصصان در Anthropic و DeepMind. |
| **[گاردریل‌های نمو (NeMo Guardrails)](https://github.com/NVIDIA-NeMo/Guardrails)** | NVIDIA | رایگان (Free) | نوت‌بوک‌های عملی برای ساخت گاردریل‌های سطح محیط عملیاتی با استفاده از NeMo Guardrails. |

---

## ایجنت‌های کدنویسی و ابزارهای هوش مصنوعی توسعه‌دهنده (Coding Agents & Developer AI Tools) <a name="coding-agents"></a>

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا قابل اعتماد است (Why It's Trusted) |
|---|---|---|---|
| **[مستندات رسمی کلود کد (Claude Code: Official Docs)](https://code.claude.com/docs/en/overview)** | Anthropic | رایگان (Free) | نقطه شروع جامع و قطعی برای Claude Code. شامل پوشش CLAUDE.md (و خواندن AGENTS.md موجود)، مهارت‌ها (skills)، قلاب‌ها (hooks)، ساب‌ایجنت‌ها (subagents)، Agent SDK و مدیریت دسترسی‌ها (permissions). |
| **[کلود کد در عمل (Claude Code in Action)](https://academy.claude.com/courses/claude-code-in-action)** | Anthropic (Claude Academy) | رایگان (Free) | دوره‌ای کوتاه و خودآموز (۹ درس، حدود یک ساعت) درباره نشست‌های کاری طولانی و خودکار (hands-off): هدایت (steering)، پیکربندی، اتوماسیون و راستی‌آزمایی اجراهای بدون نظارت. |
| **[ساخت ایجنت‌های کد (هاگینگ فیس) (Building Code Agents (Hugging Face))](https://huggingface.co/learn/agents-course/unit1/introduction)** | Hugging Face | رایگان (Free) | دوره رسمی ایجنت‌های Hugging Face که شامل فصلی در مورد ساخت ایجنت‌های اجرای کد با smolagents است. |
| **[مستندات اوپن‌هندز (OpenHands Documentation)](https://docs.openhands.dev/)** | OpenHands | رایگان (Free) | مستندات رسمی ایجنت کدنویسی خودکار OpenHands: شامل بوم مرورگر (browser canvas)، رابط خط فرمان (CLI) و Software Agent SDK. |

> 📖 همچنین راهنماهای این مخزن را ببینید: [راهنمای Claude Code](09-frameworks-and-tools/09-claude-code.md) و [چشم‌انداز OpenCoder](09-frameworks-and-tools/10-opencoderguide.md)

---

## برای مدیران محصول و افراد غیرفنی (For PMs & Non-Engineers) <a name="pm-track"></a>

این دوره‌ها به هیچ تجربه‌ای در زمینه Python نیاز ندارند:

| دوره (Course) | ارائه‌دهنده (Provider) | هزینه (Cost) | چرا خوب است (Why It's Good) |
|---|---|---|---|
| **[هوش مصنوعی برای همه (AI for Everyone)](https://www.coursera.org/learn/ai-for-everyone)** | DeepLearning.AI (Coursera) | رایگان (Free) | دوره اندرو ان‌جی برای نقش‌های غیرفنی. پوشش توانایی‌ها و محدودیت‌های هوش مصنوعی و رهبری پروژه. |
| **[مهندسی Prompt برای همه (Prompt Engineering for Everyone)](https://learnprompting.org/)** | Learn Prompting | رایگان (Free) | راهنمایی ساده و شفاف درباره مهندسی Prompt برای افراد غیرمهندس. |
| **[ارزیابی‌های هوش مصنوعی برای مهندسان و مدیران محصول (AI Evals For Engineers & PMs (Maven))](https://maven.com/parlance-labs/evals)** | Hamel Husain & Shreya Shankar | پولی (Paid) | علیرغم داشتن کد، این دوره نه فقط برای مهندسان، بلکه برای مدیران محصول (PMها) و کارشناسان تضمین کیفیت (QAها) طراحی شده است. به شدت توصیه می‌شود. |
| **[مدیر محصول هوش مصنوعی: نقشی واقعی یا واژه‌ای تبلیغاتی؟ (AI Product Manager: Real Role or Buzzword?)](https://productschool.com/blog/artificial-intelligence/guide-ai-product-manager)** | Product School | رایگان (وبلاگ) (Free (blog)) | راهنمای کاربردی درباره اینکه یک مدیر محصول هوش مصنوعی (AI PM) واقعاً چه کاری انجام می‌دهد، چه تفاوتی با مدیری دارد که صرفاً از ابزارهای هوش مصنوعی استفاده می‌کند، و چه مهارت‌هایی را باید تقویت کرد. |
| **[گوگل: مقدمه‌ای بر هوش مصنوعی مولد (Google: Introduction to Generative AI)](https://cloud.google.com/learn/training/machinelearning-ai)** | Google Cloud Skills Boost | رایگان (Free) | مقدمه‌ای بدون نیاز به کدنویسی (No-code) بر هوش مصنوعی مولد، LLMها و هوش مصنوعی مسئولانه. |

---

## کانال‌های یوتیوب و محتوای رایگان (YouTube Channels & Free Content) <a name="free"></a>

| کانال / منبع (Channel / Resource) | تمرکز (Focus) | چرا دنبال کنیم (Why Follow) |
|---|---|---|
| **[آندری کارپاتی (Andrej Karpathy)](https://www.youtube.com/@AndrejKarpathy)** | مبانی، ترنسفورمرها (Foundations, transformers) | بهترین توضیحات درباره نحوه کارکرد واقعی LLMها |
| **[یانیک کیلچر (Yannic Kilcher)](https://www.youtube.com/@YannicKilcher)** | بررسی مقالات (Paper reviews) | بررسی‌های شفاف و گام‌به‌گام از جدیدترین مقالات پژوهشی ML |
| **[الکسا گوردیچ - مکاشفه هوش مصنوعی (Aleksa Gordić - The AI Epiphany)](https://www.youtube.com/@TheAIEpiphany)** | بررسی مقالات (Paper reviews) | تحلیل و کالبدشکافی عمیق و فنی مقالات پژوهشی |
| **[ای‌آی جیسون (AI Jason)](https://www.youtube.com/@AIJasonZ)** | ایجنت‌ها، LangChain، کاربردی (Agents, LangChain, practical) | ویدیوهای مقدماتی عالی برای فریم‌ورک‌های ایجنتی (agentic frameworks) |
| **[سم ویتوین (Sam Witteveen)](https://www.youtube.com/@samwitteveenai)** | جمینای، RAG، ایجنت‌ها (Gemini, RAG, agents) | یکی از بهترین یوتیوبرهای حوزه هوش مصنوعی کاربردی |
| **[مت ولف (Matt Wolfe)](https://www.youtube.com/@mreflow)** | اخبار هوش مصنوعی، دموهای محصول (AI news, product demos) | بهترین گزینه برای به‌روز ماندن در جریان اخبار و ابزارهای هوش مصنوعی |
| **[هامل حسین (وبلاگ) (Hamel Husain (blog))](https://hamel.dev/)** | ارزیابی‌ها، هوش مصنوعی عملیاتی، LLMها (Evals, production AI, LLMs) | بینش‌های واقعی از محیط عملیاتی توسط نویسنده دوره ارزیابی‌های Maven |
| **[سایمون ویلیسون (وبلاگ) (Simon Willison (blog))](https://simonwillison.net/)** | اخبار LLM، ابزارها، کدنویسی (LLM news, tools, coding) | معتبرترین منبع روزانه اخبار هوش مصنوعی |
| **[پادکست لیتنت اسپیس (The Latent Space podcast)](https://www.latent.space/)** | مصاحبه‌های فنی هوش مصنوعی (Technical AI interviews) | بهترین پادکست فنی هوش مصنوعی با گفتگوهای عمیق با پژوهشگران |
| **[پادکست لکس فریدمن (Lex Fridman Podcast)](https://lexfridman.com/podcast/)** | مصاحبه‌های گسترده در زمینه AI/ML (Broad AI/ML interviews) | مصاحبه‌های مفصل و طولانی با برترین پژوهشگران حوزه هوش مصنوعی |

---

## پیشنهادهای مسیر یادگیری (Learning Path Suggestions) <a name="paths"></a>

### 🛤️ مسیر: «در هوش مصنوعی تازه‌کار هستم و می‌خواهم سریع سیستم بسازم»

```
Week 1: Prompt Engineering for Developers (DeepLearning.AI): free, 2 hrs
Week 2: Building Systems with ChatGPT API (DeepLearning.AI): free, 2 hrs
Week 3: Building and Evaluating Advanced RAG (DeepLearning.AI): free, 2 hrs
Week 4: AI Agents in LangGraph (DeepLearning.AI): free, 4 hrs
Month 2: Pick a real project, use this guide as reference
```

### 🛤️ مسیر: «می‌خواهم LLMها را به صورت عمیق درک کنم»

```
Week 1-3: Neural Networks: Zero to Hero (Karpathy): free, 12+ hrs
Week 4-6: CS324 Stanford LLMs: free, 30+ hrs
Month 2: Generative AI with LLMs (Coursera DeepLearning.AI)
Month 3: CS294 LLM Agents (Berkeley)
```

### 🛤️ مسیر: «می‌خواهم ارزیابی هوش مصنوعی آماده محیط عملیاتی بسازم»

```
Week 1: Evaluating and Debugging Generative AI (DeepLearning.AI + W&B): free
Week 2: This repo's evals guides (Phoenix/Langfuse): free  ← start here
Week 3-4: Quality and Safety for LLM Applications (DeepLearning.AI)
Month 2: AI Evals For Engineers & PMs (Maven, Hamel + Shreya): paid, worth it
```

### 🛤️ مسیر: «من مدیر محصول هستم و می‌خواهم در ارتقای کیفیت محصول هوش مصنوعی نقش داشته باشم»

```
Week 1: AI for Everyone (Coursera): free
Week 2: Prompt Engineering for Everyone (learnprompting.org): free
Week 3: AI Evals guide in this repo: free (especially Chapters 1-3 on error analysis)
Month 2: AI Evals For Engineers & PMs (Maven): paid, has PM track
```

### 🛤️ مسیر: «می‌خواهم ایجنت‌های کدنویسی را در تیمم مستقر کنم»

```
Day 1: Claude Code docs (code.claude.com): free
Week 1: This repo's Claude Code Guide + OpenCoder Landscape Guide
Week 2: Claude Code in Action (Claude Academy) + Building Code Agents (Hugging Face): free
Month 1: Run Claude Code on a real project in CI
```

---

## چگونه به‌روز بمانیم (How to Stay Current)

هوش مصنوعی با سرعت بالایی پیش می‌رود. فراتر از دوره‌ها، این عادت‌ها شما را به‌روز نگه می‌دارند:

1. **وبلاگ سایمون ویلیسون (Simon Willison) را دنبال کنید**: خلاصه‌های روزانه و قابل اعتماد از اخبار هوش مصنوعی
2. **یادداشت‌های انتشار انتروپیک و OpenAI را بخوانید**: منابع دست‌اول بسیار بهتر از خلاصه‌های دست‌دوم هستند
3. **پادکست Latent Space را دنبال کنید**: بالاترین عمق فنی
4. **در پروژه‌های متن‌باز مشارکت کنید** (OpenHands، LlamaIndex، DSPy): یادگیری واقعی در PRها اتفاق می‌افتد
5. **به این مخزن ستاره (Star) بدهید**: با تغییرات این حوزه، ما آن را به‌روزرسانی می‌کنیم ⭐

---

*نگهداری‌شده توسط [Om Bharatiya](https://github.com/ombharatiya). ارسال PR برای افزودن دوره‌های جدید با استقبال پذیرفته می‌شود!*
