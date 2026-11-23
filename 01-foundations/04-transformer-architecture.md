<div dir="rtl">

# معماری ترنسفورمر (Transformer Architecture)

این فصل دیدگاهی جامع از معماری کامل ترنسفورمر ارائه می‌دهد و اجزای مطرح‌شده در فصل‌های پیشین را در قالب یک درک یکپارچه گرد هم می‌آورد.

## فهرست مطالب

- [نمای کلی معماری](#architecture-overview)
- [پردازش ورودی](#input-processing)
- [بلاک ترنسفورمر](#the-transformer-block)
- [پردازش خروجی](#output-processing)
- [مقایسه Embeddingهای متصل و غیرمتصل (Untied vs. Tied)](#untied-vs-tied-embeddings)
- [انواع معماری‌های مدرن (Hybrid MoE و MLA)](#modern-architecture-variations)
- [ویژگی‌های مقیاس‌پذیری](#scaling-properties)
- [جدول مقایسه معماری‌ها](#architecture-comparison-table)
- [سوالات مصاحبه](#interview-questions)
- [منابع](#references)

---

## نمای کلی معماری

یک ترنسفورمر فقط-دیکودر (Decoder-only) (معماری نهفته در GPT-3، Llama و اکثر مدل‌های متن‌باز، و مدلی که به‌طور گسترده برای مدل‌های پیشروی بسته که طراحی آن‌ها منتشر نشده نیز فرض می‌شود) از بخش‌های زیر تشکیل شده است:

<div dir="ltr">

```
┌─────────────────────────────────────────────────────────────────┐
│                     Token Embeddings                            │
│              + Position Embeddings (or RoPE)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐      │
│    │                  Transformer Block                   │      │
│    │  ┌─────────────────────────────────────────────┐    │      │
│    │  │              RMSNorm/LayerNorm              │    │      │
│    │  └───────────────────┬─────────────────────────┘    │      │
│    │                      ▼                              │      │
│    │  ┌─────────────────────────────────────────────┐    │      │
│    │  │         Masked Multi-Head Attention         │    │      │
│    │  │            (with KV Cache)                  │    │      │
│    │  └───────────────────┬─────────────────────────┘    │      │
│    │                      │                              │      │
│    │                  + Residual                         │      │
│    │                      │                              │      │
│    │  ┌─────────────────────────────────────────────┐    │      │
│    │  │              RMSNorm/LayerNorm              │    │      │
│    │  └───────────────────┬─────────────────────────┘    │      │
│    │                      ▼                              │      │
│    │  ┌─────────────────────────────────────────────┐    │      │
│    │  │             Feed-Forward Network            │    │      │
│    │  │               (SwiGLU/GELU)                 │    │      │
│    │  └───────────────────┬─────────────────────────┘    │      │
│    │                      │                              │      │
│    │                  + Residual                         │      │
│    └──────────────────────┴──────────────────────────────┘      │
│                           │                                     │
│                    Repeat × N layers                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Output RMSNorm                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Language Model Head                           │
│              (Linear: hidden_dim → vocab_size)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                         Logits
```

</div>

---

## پردازش ورودی

### بازنمایی Token (Token Embedding)

تبدیل شناسه Tokenها (token IDs) به بردارهای متراکم (dense vectors):

<div dir="ltr">

```python
class TokenEmbedding(nn.Module):
    def __init__(self, vocab_size, d_model):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
    
    def forward(self, token_ids):
        return self.embedding(token_ids)
```

</div>

**ابعاد (Dimensions):**
- ورودی: شناسه Tokenها با ابعاد [batch_size, seq_len]
- خروجی: Embeddingها با ابعاد [batch_size, seq_len, d_model]

### اطلاعات موقعیت

اطلاعات موقعیت از طریق یکی از روش‌های زیر اعمال می‌شود:

**۱. تعبیه موقعیت چرخشی (RoPE - Rotary Position Embedding):**
درون سازوکار توجه اعمال می‌شود و به Embeddingها اضافه نمی‌گردد:

<div dir="ltr">

```python
def apply_rope(q, k, positions):
    # Rotate q and k vectors based on position
    freqs = compute_frequencies(positions)
    q_rotated = rotate_embeddings(q, freqs)
    k_rotated = rotate_embeddings(k, freqs)
    return q_rotated, k_rotated
```

</div>

**۲. تعبیه موقعیت یادگیری‌شده (Learned Position Embeddings):**
مستقیماً به Embeddingهای Token اضافه می‌شود:

<div dir="ltr">

```python
position_embeddings = nn.Embedding(max_seq_len, d_model)
x = token_embeddings + position_embeddings(positions)
```

</div>

**مدل‌های متن‌باز مدرن (Llama، Mistral، Qwen، DeepSeek و Gemma) از RoPE استفاده می‌کنند** تا تعمیم‌پذیری به طول‌های بیشتر (Length Generalization) بهبود یابد؛ این مدل‌ها اغلب از روش‌های مقیاس‌بندی نظیر YaRN برای گسترش پنجره کانتکست آموزش‌دیده بهره می‌برند. آزمایشگاه‌های سازنده مدل‌های بسته، اطلاعات مربوط به روش‌های کدگذاری موقعیت خود را منتشر نمی‌کنند.

---

## بلاک ترنسفورمر

### ساختار پیش‌نرمال‌سازی

ترنسفورمرهای مدرن از پیش‌نرمال‌سازی (Pre-normalization) استفاده می‌کنند:

<div dir="ltr">

```python
class TransformerBlock(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.attn_norm = RMSNorm(config.d_model)
        self.attn = GroupedQueryAttention(
            d_model=config.d_model,
            n_heads=config.n_heads,
            n_kv_heads=config.n_kv_heads
        )
        self.ff_norm = RMSNorm(config.d_model)
        self.ff = SwiGLUFFN(
            d_model=config.d_model,
            d_ff=config.d_ff
        )
    
    def forward(self, x, mask=None, kv_cache=None):
        # Attention with residual
        h = x + self.attn(self.attn_norm(x), mask, kv_cache)
        
        # FFN with residual
        out = h + self.ff(self.ff_norm(h))
        
        return out
```

</div>

### مؤلفه توجه

<div dir="ltr">

```python
class GroupedQueryAttention(nn.Module):
    def __init__(self, d_model, n_heads, n_kv_heads):
        super().__init__()
        self.n_heads = n_heads
        self.n_kv_heads = n_kv_heads
        self.head_dim = d_model // n_heads
        
        self.q_proj = nn.Linear(d_model, n_heads * self.head_dim)
        self.k_proj = nn.Linear(d_model, n_kv_heads * self.head_dim)
        self.v_proj = nn.Linear(d_model, n_kv_heads * self.head_dim)
        self.o_proj = nn.Linear(n_heads * self.head_dim, d_model)
    
    def forward(self, x, mask, kv_cache):
        B, T, D = x.shape
        
        # Project
        q = self.q_proj(x).view(B, T, self.n_heads, self.head_dim)
        k = self.k_proj(x).view(B, T, self.n_kv_heads, self.head_dim)
        v = self.v_proj(x).view(B, T, self.n_kv_heads, self.head_dim)
        
        # Apply RoPE
        q, k = apply_rope(q, k, positions)
        
        # Update KV cache
        if kv_cache is not None:
            k = torch.cat([kv_cache.k, k], dim=1)
            v = torch.cat([kv_cache.v, v], dim=1)
            kv_cache.update(k, v)
        
        # Repeat KV heads for GQA
        k = k.repeat_interleave(self.n_heads // self.n_kv_heads, dim=2)
        v = v.repeat_interleave(self.n_heads // self.n_kv_heads, dim=2)
        
        # Attention (using Flash Attention in practice)
        attn_out = flash_attention(q, k, v, mask)
        
        # Output projection
        out = self.o_proj(attn_out.view(B, T, -1))
        return out
```

</div>

### شبکه پیش‌خور

<div dir="ltr">

```python
class SwiGLUFFN(nn.Module):
    def __init__(self, d_model, d_ff):
        super().__init__()
        # SwiGLU has 3 projections instead of 2
        self.gate_proj = nn.Linear(d_model, d_ff, bias=False)
        self.up_proj = nn.Linear(d_model, d_ff, bias=False)
        self.down_proj = nn.Linear(d_ff, d_model, bias=False)
    
    def forward(self, x):
        gate = F.silu(self.gate_proj(x))  # SiLU = Swish
        up = self.up_proj(x)
        return self.down_proj(gate * up)
```

</div>

**بُعد پنهان FFN (FFN hidden dimension)** برای SwiGLU معمولاً ۲.۷ تا ۳.۵ برابر بُعد مدل است (در مقایسه با ۴ برابر در یک FFN استاندارد با GELU). در نسبت ۸/۳ (حدود ۲.۶۷ برابر)، سه ماتریس SwiGLU به اندازه یک FFN دوماتریسی با ضریب ۴ برابر پارامتر دارند؛ مدل Llama 2 7B از حدود ۲.۷ برابر استفاده می‌کند، در حالی که Llama 2 70B و Llama 3 این بُعد را تا ۳.۵ برابر افزایش می‌دهند.

### نرمال‌سازی RMS (RMSNorm)

<div dir="ltr">

```python
class RMSNorm(nn.Module):
    def __init__(self, d_model, eps=1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(d_model))
        self.eps = eps
    
    def forward(self, x):
        rms = torch.sqrt(torch.mean(x ** 2, dim=-1, keepdim=True) + self.eps)
        return self.weight * (x / rms)
```

</div>

ساده‌تر و سریع‌تر از LayerNorm است؛ چرا که مرحله کسر میانگین (Mean Centering) را حذف می‌کند.

---

## پردازش خروجی

### نرمال‌سازی نهایی

اعمال RMSNorm پس از آخرین بلاک ترنسفورمر:

<div dir="ltr">

```python
hidden_states = self.output_norm(hidden_states)
```

</div>

### سر مدل زبانی (Language Model Head)

نگاشت به اندازه واژگان (Vocabulary Size):

<div dir="ltr">

```python
class LMHead(nn.Module):
    def __init__(self, d_model, vocab_size):
        super().__init__()
        self.linear = nn.Linear(d_model, vocab_size, bias=False)
    
    def forward(self, x):
        return self.linear(x)  # Returns logits
```

</div>

### دریافت پیش‌بینی‌ها

<div dir="ltr">

```python
# During generation
logits = lm_head(hidden_states[:, -1, :])  # Last position only
next_token = sample(logits)

# During training
logits = lm_head(hidden_states)  # All positions
loss = cross_entropy(logits, targets)
```

</div>

## مقایسه Embeddingهای متصل و غیرمتصل (Untied vs. Tied Embeddings)

**متصل یا Tied (مدل‌های GPT-2، T5، Gemma، و مدل‌های کوچک Llama 3.2 و Qwen):** اشتراک وزن (Weight Tying)
- سر خروجی، وزن‌های خود را با Embeddingهای ورودی به اشتراک می‌گذارد.
- **مزیت (Pro)**: صرفه‌جویی در مصرف حافظه (vocab_size * hidden_dim).
- **عیب (Con)**: فضاهای پنهان (Latent Spaces) ورودی و خروجی را مجبور می‌کند کاملاً یکسان باشند، که می‌تواند عملکردی زیر حد بهینه (Suboptimal) داشته باشد.

**غیرمتصل یا Untied (مدل‌های Llama 1 تا 3 با اندازه 7B و بالاتر، و اکثر مدل‌های متن‌باز بزرگ):** سر خروجی مجزا (Separate Output Head)
- سر خروجی وزن‌های مختص به خود را دارد.
- **چرا اندازه مدل تعیین‌کننده است؟**: با واژگانی در اندازه ۱۲۸K تا ۲۶۲K، جدول Embedding بخش بزرگی از حجم یک مدل کوچک را تشکیل می‌دهد. جدول Llama 3.2 1B حدود ۲۶۳ میلیون پارامتر دارد (128,256 x 2,048) که تقریباً یک‌پنجم کل مدل است، و جدول Gemma 3 1B حدود ۳۰۰ میلیون پارامتر دارد (262,144 x 1,152) که نزدیک به یک‌سوم مدل است. اتصال وزن‌ها (Tying) این فضا را ذخیره می‌کند. در مدل‌های 70B به بالا، این جدول در مقایسه با کل مدل مانند خطای گرد کردن (ناچیز) است؛ بنابراین آزمایشگاه‌ها وزن‌ها را جدا (Untie) می‌کنند تا سر خروجی بتواند به‌طور تخصصی عمل کند.
- **تأثیر بر سیستم (System Impact)**: جدا کردن وزن‌ها (Untying) تعداد vocab_size x d_model پارامتر اضافی برای بارگذاری و ارائه سرویس (Serving) اضافه می‌کند؛ برای مدل‌های لبه (Edge Models)، اتصال وزن‌ها اغلب مرز بین جا شدن یا نشدن مدل در حافظه دستگاه است.

---

## گونه‌های معماری مدرن

### معماری Llama 2/3

| مولفه | پیاده‌سازی |
|-----------|----------------|
| توجه (Attention) | توجه کوئری گروه‌بندی‌شده (Grouped Query Attention - GQA) |
| موقعیت (Position) | تعبیه موقعیت چرخشی (Rotary Position Embedding - RoPE) |
| نرمال‌سازی (Normalization) | نرمال‌سازی RMSNorm (از نوع pre-norm) |
| فعال‌ساز (Activation) | SwiGLU |
| بایاس (Bias) | بدون بایاس در لایه‌های خطی |

### معماری Mistral 7B

مشابه Llama است، اما موارد زیر را اضافه می‌کند:
- **توجه پنجره لغزان (Sliding Window Attention):** هر لایه تنها به ۴K از Tokenها توجه می‌کند
- اطلاعات همچنان از طریق لایه‌های روی‌هم‌چیده‌شده به فواصل دورتری انتشار می‌یابند (گستره نظری با افزایش عمق رشد می‌کند)
- نسخه‌های بعدی Mistral استفاده از SWA خالص را کنار گذاشتند؛ با این حال این ایده در قالب لایه‌های متناوب پنجره لغزان و لایه‌های سراسری (global) به بقای خود ادامه داد (مانند Gemma 2 و 3، gpt-oss، و مدل‌های سال ۲۰۲۶ نظیر MiMo-V2.6-Pro؛ به بخش زیر مراجعه کنید)

### ترکیب متخصصان (MoE) و معماری‌های هیبریدی

پیشرفته‌ترین مدل‌های متن‌باز بلوک‌های متراکم (dense) و تنک (sparse) را با هم ترکیب می‌کنند و به‌طور فزاینده‌ای انواع توجه را نیز در هم می‌آمیزند:
- **لایه‌های متراکم به همراه متخصصان مشترک (Dense layers plus shared experts)**: برخی از طرح‌ها لایه‌های ابتدایی را متراکم نگه می‌دارند (DeepSeek-V3: ۳ لایه نخست؛ Tencent Hy4: ۱ لایه نخست)، در حالی که برخی دیگر لایه‌های متراکم و MoE را به‌صورت متناوب قرار می‌دهند (Llama 4 Maverick). بسیاری از مدل‌ها یک **متخصص مشترک (shared expert)** اضافه می‌کنند که هر Token علاوه بر متخصصان مسیردهی‌شده (routed) از آن عبور می‌کند (DeepSeek V4.1-Flash: ۳۸۴ متخصص مسیردهی‌شده به‌علاوه ۱ متخصص مشترک، با ۶ متخصص مسیردهی‌شده فعال به ازای هر Token؛ در Hy4: ۲۵۶ متخصص مسیردهی‌شده به‌علاوه ۱ متخصص مشترک، top-8).
- **توجه هیبریدی (Hybrid attention)**: لایه‌های توجه خطی (Linear-attention) یا پنجره لغزان بخش عمده‌ای از عمق مدل را بر دوش می‌کشند، در حالی که اقلیتی از لایه‌های توجه کامل (full) یا تنک برای یادآوری دقیق (precise recall) به کار می‌روند (Qwen3.8-Flash-Next: مکانیزم Gated DeltaNet در ۳ لایه از هر ۴ لایه؛ MiMo-V2.6-Pro: ۶۰ لایه پنجره لغزان و ۱۰ لایه سراسری). بخش [سازوکارهای توجه](03-attention-mechanisms.md#hybrid-and-sparse-attention-in-2026-open-models) را ببینید.
- **موازی‌سازی متخصصان (Expert Parallelism)**: توزیع متخصصان مختلف در چندین GPU مختلف. این امر باعث می‌شود **پهنای باند بین‌گره‌ای** (NVLink/InfiniBand) و ارتباطات همه-به-همه (all-to-all) به یک گلوگاه اصلی معماری تبدیل شود؛ به همین دلیل است که استک‌های خدمت‌رسانی (serving stacks) اکنون در حال آزمایش تفکیک توجه-FFN هستند (قرارگیری توجه در یک استخر محاسباتی و متخصصان در استخری دیگر).

### یکپارچه‌سازی توجه نهفته چند سر (MLA)
بلوک توجه در [DeepSeek-V3](03-attention-mechanisms.md#multi-head-latent-attention-mla) و مدل‌هایی که آن را به کار گرفته‌اند (Kimi K2 و Tencent Hy4)، پروجکشن‌های استاندارد K/V را با یک فشرده‌سازی نهفته کم‌رتبه (low-rank latent compression) جایگزین می‌کند.
- **تحول معماری (Architectural Shift)**: در حال حاضر «KV Cache» یک نمایش پنهان (latent) فشرده‌شده است که نسبت حافظه به محاسبات (memory/compute ratio) را در کل بلوک ترنسفورمر تغییر می‌دهد.
- **فراتر از MLA**: سری V4 مدل‌های DeepSeek آن را با ترکیبی از توجه تنک فشرده (Compressed Sparse Attention) و توجه به‌شدت فشرده (Heavily Compressed Attention) جایگزین کرد و V4.1-Flash نیز KV دیکودر را از حالت‌های انکودر پروجکت می‌کند. اکنون «KV cache» همان چیزی است که معماری مدل تعریف می‌کند؛ به همین دلیل تعیین اندازه KV باید از کارت مشخصات مدل آغاز شود.

### مقایسه انتخاب‌ها

| انتخاب | رویکرد قدیمی | رویکرد مدرن | مزیت |
|--------|--------------|-----------------|---------|
| نرمال‌سازی (Norm) | Post-LN | Pre-LN / RMSNorm | پایداری و سرعت آموزش |
| موقعیت (Position) | سینوسی / یادگیری‌شده (Sinusoidal/Learned) | RoPE | برون‌یابی بهتر |
| فعال‌ساز (Activation) | GELU | SwiGLU | کیفیت بالاتر (۱٪+ در بنچمارک‌ها) |
| توجه (Attention) | MHA | مکانیزم GQA؛ لایه‌های MLA یا هیبریدی در مدل‌های پرچم‌دار متن‌باز ۲۰۲۶ | کاهش ۸ برابری اندازه KV cache با GQA، و بسیار بیشتر با MLA یا مدل‌های هیبریدی |
| بایاس (Bias) | با بایاس | بدون بایاس | پارامترهای کمتر، کیفیت مشابه |

---

## ویژگی‌های مقیاس‌پذیری (Scaling Properties)

### شمارش پارامترها

| مولفه | پارامترها |
|-----------|------------|
| Token embedding | vocab_size * d_model |
| پروجکشن Q/K/V در هر لایه | 3 * d_model * d_model (برای MHA) |
| پروجکشن O در هر لایه | d_model * d_model |
| لایه FFN در هر لایه | 3 * d_model * d_ff (برای SwiGLU) |
| سر زبانی (LM head) | ماتریس d_model * vocab_size (در مدل‌های کوچک به‌صورت اشتراکی/tied) |

**تقریب برای مدل‌های فقط دیکودر (decoder-only):**

<div dir="ltr">

```
Total ≈ 12 * n_layers * d_model^2 (for d_ff = 4 * d_model, MHA)
```

</div>

این رابطه یک FFN دوماتریسی را در ضریب 4x فرض می‌کند. یک FFN از نوع SwiGLU در d_ff = 8/3 * d_model همان مقدار 8 * d_model^2 به ازای هر لایه را به همراه دارد؛ GQA و FFNهای عریض‌تر SwiGLU این نسبت تسهیم را تغییر می‌دهند، و جدول Embedding نیز مقدار vocab_size * d_model را به این مجموع اضافه می‌کند.

### نیازمندی‌های محاسباتی

**آموزش:** تعداد FLOPs به ازای هر Token ≈ ۶ * تعداد پارامترها (پیش‌خور + پس‌انتشار)

**استنتاج (Inference):** تعداد FLOPs به ازای هر Token ≈ ۲ * تعداد پارامترها (فقط پیش‌خور)

برای مدل‌های MoE، در هر دو فرمول از پارامترهای فعال استفاده کنید؛ حافظه همچنان با کل پارامترها مقیاس می‌شود.

### قوانین مقیاس‌پذیری (Scaling Laws)

قانون مقیاس‌پذیری چینچیلا (Chinchilla) تخصیص بهینه را پیشنهاد می‌دهد:

<div dir="ltr">

```
D (data tokens) ≈ 20 * N (parameters)
```

</div>

برای یک مدل ۷۰B، جهت آموزش بهینه از نظر محاسباتی (compute-optimal)، آموزش روی حدود ۱.۴T از Tokenها انجام می‌شود.

**اما:** بسیاری از مدل‌های مدرن برای دستیابی به بهره‌وری بهتر در استنتاج (inference efficiency)، نسبت به معیار چینچیلا بیش‌ازحد آموزش می‌بینند (overtrain می‌شوند). مدل Llama 2 روی ۲T از Tokenها آموزش دید؛ در حالی که Llama 3 8B بیش از ۱۵T از Tokenها را دید که تقریباً معادل ۱,۹۰۰ Token به ازای هر پارامتر و حدود ۹۵ برابر نسبت چینچیلا است.

---

## جدول مقایسه معماری‌ها

| مدل | پارامترها | لایه‌ها | d_model | هدها | هدهای KV | FFN | زمینه (Context) |
|-------|--------|--------|---------|-------|----------|-----|---------|
| GPT-3 | 175B | 96 | 12288 | 96 | 96 | GELU | 2K |
| Llama 2 70B | 70B | 80 | 8192 | 64 | 8 | SwiGLU | 4K |
| Llama 3.1 405B | 405B | 126 | 16384 | 128 | 8 | SwiGLU | 128K |
| DeepSeek V3 | 671B (۳۷B فعال) | 61 | 7168 | 128 | MLA | MoE | 128K |
| Llama 4 Maverick | 400B (۱۷B فعال) | 48 | 5120 | 40 | 8 | معماری MoE، لایه‌های متناوب | 1M |
| DeepSeek V4.1-Flash | بدنه اصلی ۵۵۲B (۸B فعال در prefill / ۱۶B در decode) | ۴۰ (۲۰ انکودر + ۲۰ دیکودر) | 5120 | 64 | فشرده (پروجکت‌شده از انکودر) | معماری MoE، ۳۸۴ + ۱ مشترک | 1M |

مدل Mistral 7B (که در جدول نمایش داده نشده است) در تمام لایه‌ها از توجه پنجره لغزان (sliding window attention) استفاده می‌کند؛ مدل‌های متن‌باز سال ۲۰۲۶ در عوض لایه‌های پنجره لغزان یا لایه‌های توجه خطی (linear-attention) را با لایه‌های سراسری (global) به‌صورت متناوب ترکیب می‌کنند.

دو روند برجسته از ردیف‌های پایینی جدول مشخص است: پارامترهای فعال دیگر همراه با کل پارامترها رشد نمی‌کنند، و طراحی KV (شامل MLA، فشرده و هیبریدی) اکنون نسبت به تعداد لایه‌ها یا عرض مدل، تنوع بسیار بیشتری میان مدل‌های گوناگون دارد. پیکربندی‌های GPT، Claude و Gemini عمومی نیستند.

---

## سوالات مصاحبه

### پرسش: مراحل گذر رو به جلو (forward pass) یک ترنسفورمر را توضیح دهید.

**پاسخ قوی:**
برای یک مدل فقط دیکودر (decoder-only) در حال تولید متن:

۱. **فرآیند Tokenization:** تبدیل متن ورودی به شناسه‌های Token (یا همان token IDها)

۲. **تعبیه (Embedding):** بازیابی Embeddingهای Token از جدول Embedding

۳. **به ازای هر لایه ترنسفورمر:**
   - اعمال RMSNorm بر روی ورودی
   - محاسبه پروجکشن‌های Q، K و V
   - اعمال RoPE بر روی Q و K برای موقعیت
   - برای فرآیند تولید: افزودن K و V جدید به KV cache
   - محاسبه توجه (به‌صورت پوشش‌دار یا masked، به نحوی که هر موقعیت تنها موقعیت‌های قبلی را ببیند)
   - پروجکشن خروجی توجه و افزودن اتصال پسماند (residual)
   - اعمال RMSNorm
   - عبور از شبکه پیش‌خور (feed-forward network) از نوع SwiGLU
   - افزودن اتصال پسماند (residual)

۴. **نرمال‌سازی خروجی (Output norm):** اعمال RMSNorm نهایی

۵. **سر مدل زبانی (LM head):** پروجکت کردن به اندازه واژگان (vocabulary size) جهت دستیابی به لاجیت‌ها (logits)

۶. **نمونه‌گیری (Sample):** انتخاب Token بعدی از لاجیت‌ها با استفاده از temperature/top-p

برای فرآیند تولید، مراحل ۳ تا ۶ برای هر Token جدید تکرار می‌شوند و از KV cache موقعیت‌های قبلی مجدداً استفاده می‌گردد.

### پرسش: تفاوت میان pre-norm و post-norm چیست؟

**پاسخ قوی:**
تفاوت در این است که نرمال‌سازی لایه‌ای در مقایسه با زیرلایه‌ها (توجه، FFN) در کجا اعمال می‌شود:

**روش Post-norm (ترنسفورمر اولیه):**

<div dir="ltr">

```
x = LayerNorm(x + Sublayer(x))
```

</div>
نرمال‌سازی پس از افزودن اتصال پسماند (residual) اعمال می‌شود.

**روش Pre-norm (ترنسفورمرهای مدرن):**

<div dir="ltr">

```
x = x + Sublayer(LayerNorm(x))
```

</div>
نرمال‌سازی پیش از ورود به زیرلایه اعمال می‌شود.

روش Pre-norm ترجیح داده می‌شود زیرا:
۱. گرادیان‌ها به‌طور مستقیم‌تر از طریق اتصالات پسماند (residual connections) جریان می‌ابند
۲. آموزش به‌ویژه برای مدل‌های عمیق بسیار پایدارتر است
۳. حساسیت کمتری نسبت به مقداردهی اولیه و نرخ یادگیری وجود دارد
۴. امکان آموزش بدون مرحله گرم‌کردن (warmup) طولانی نرخ یادگیری که Post-LN به آن وابسته است فراهم می‌شود (هرچند اغلب آموزش‌ها همچنان از یک warmup کوتاه استفاده می‌کنند)

هزینه این رویکرد، عملکرد نهایی اندکی پایین‌تر در برخی بنچمارک‌ها است، اما پایداری آموزش برای مدل‌های بزرگ کاملاً ارزش آن را دارد.

### پرسش: مکانیزم GQA را توضیح دهید و بگویید چرا برای خدمت‌رسانی (serving) اهمیت دارد.

**پاسخ قوی:**
مکانیزم توجه کوئری گروه‌بندی‌شده (Grouped Query Attention یا GQA) هدهای Key و Value را در میان گروه‌هایی از هدهای Query به اشتراک می‌گذارد.

توجه چندسره استاندارد (Standard Multi-Head Attention): ۶۴ هد query، ۶۴ هد KV (نسبت ۱:۱)
مکانیزم GQA: ۶۴ هد query، ۸ هد KV (نسبت ۸:۱)

پیاده‌سازی: هر هد KV از طریق تکرار (repetition) توسط ۸ هد query مورد استفاده قرار می‌گیرد.

**چرا این موضوع اهمیت دارد:**
ساختار KV cache مقادیر K و V را برای تمام موقعیت‌ها در طول تولید ذخیره می‌کند. برای Llama 70B در زمینه ۸K:
- روش MHA: مقدار 2.6 MB/token * 8K = 21 GB به ازای هر درخواست
- روش GQA (نسبت ۸:۱): مقدار 320 KiB/token * 8K = ~2.7 GB به ازای هر درخواست

کاهش ۸ برابری این قابلیت‌ها را ممکن می‌سازد:
- اندازه‌های دسته (batch sizes) بزرگ‌تر (کاربران همزمان بیشتر)
- زمینه‌های (contexts) طولانی‌تر
- نیازمندی کمتر به حافظه GPU

تاثیر بر کیفیت: ناچیز است. مقاله GQA نشان داد که مدل مجدداً آموزش‌دیده (uptrained) با GQA، به کیفیتی نزدیک به MHA و سرعتی نزدیک به دکود MQA دست می‌یابد؛ به همین دلیل به رویکرد پیش‌فرض مدل‌های متن‌باز تبدیل شد.

### پرسش: چه تغییراتی بین GPT-2 و Llama 2 رخ داد؟

**پاسخ قوی:**
بهبودهای کلیدی معماری:

| مولفه | GPT-2 | Llama 2 |
|-----------|-------|---------|
| نرمال‌سازی (Norm) | Post-LayerNorm | Pre-RMSNorm |
| موقعیت (Position) | مطلق یادگیری‌شده (Learned absolute) | مکانیزم RoPE (چرخشی / rotary) |
| فعال‌ساز (Activation) | GELU | SwiGLU |
| توجه (Attention) | MHA | مکانیزم GQA (برای 70B) |
| بایاس (Bias) | وجود دارد (Present) | حذف شده (Removed) |

اثرات:
- نرمال‌سازی RMSNorm: سریع‌تر و به همان اندازه موثر
- مکانیزم RoPE: برون‌یابی بهتر در طول‌های بلندتر
- فعال‌ساز SwiGLU: حدود ۱٪ بهبود کیفیت
- مکانیزم GQA: کاهش ۸ برابری اندازه KV cache برای خدمت‌رسانی (serving)
- عدم وجود بایاس: پارامترهای کمتر، بدون افت کیفیت

این تغییرات، آموزش پایدارتر مدل‌های بزرگ‌تر و خدمت‌رسانی با بهره‌وری بالاتر را امکان‌پذیر می‌سازند.

---

## مراجع

- Vaswani et al. "Attention Is All You Need" (2017)
- Touvron et al. "Llama: Open and Efficient Foundation Language Models" (2023)
- Touvron et al. "Llama 2: Open Foundation and Fine-Tuned Chat Models" (2023)
- Llama Team, AI @ Meta. "The Llama 3 Herd of Models" (2024)
- DeepSeek-AI. "DeepSeek-V3 Technical Report" (2024)
- Zhang and Sennrich. "Root Mean Square Layer Normalization" (2019)
- Shazeer. "GLU Variants Improve Transformer" (2020)
- Su et al. "RoFormer: Enhanced Transformer with Rotary Position Embedding" (2021)
- Jiang et al. "Mistral 7B" (2023)

---

*قبلی: [سازوکارهای توجه](03-attention-mechanisms.md) | بعدی: [Embeddingها و فضاهای برداری](05-embeddings-and-vector-spaces.md)*

</div>
