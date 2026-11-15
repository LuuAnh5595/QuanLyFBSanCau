import { Env } from '../types/env';

export interface GeneratedPost {
  content: string;
  suggestedTags: string[];
  topic: string;
  usedModel?: string;
}

export const DEFAULT_SYSTEM_PROMPT = `Bạn là biên tập viên sáng tạo nội dung chuyên nghiệp cho Fanpage Sân Cầu Lông (Badminton Court).
Nhiệm vụ: Viết bài đăng Facebook hoàn chỉnh, hấp dẫn, thu hút tương tác.

QUY TẮC BẮT BUỘC (CRITICAL RULES):
1. BẮT BUỘC SỬ DỤNG TIẾNG VIỆT 100%. TUYỆT ĐỐI KHÔNG DÙNG TIẾNG ANH trong toàn bộ bài viết và tiêu đề.
2. TUYỆT ĐỐI KHÔNG xuất ra bất kỳ bước suy nghĩ, phân tích, dàn ý, nháp nào (như * Role, * Goal, * Option, * Drafting, * Refining, Internal Monologue, Outline).
3. BẮT BUỘC LỒNG GHÉP ĐẦY ĐỦ các thông tin chi tiết được cung cấp (Tên sân, Địa chỉ, Số điện thoại/Hotline, Thời gian mở cửa) một cách tự nhiên, nổi bật ở thân bài và phần CTA đặt sân.
4. Bắt đầu bài viết ngay từ dòng đầu tiên bằng Tiêu đề có icon emoji thể thao (🏸, 🔥, 💥, ⚡).
5. Thân bài chia đoạn ngắn gọn, thoáng mắt, dễ đọc trên điện thoại.
6. Cuối bài có Lời kêu gọi hành động (CTA: rủ bạn bè, liên hệ hotline, inbox đặt sân) và khối Hashtag.
7. Không bọc bài viết trong dấu ngoặc kép hoặc markdown codeblock.`;

export const DEFAULT_USER_PROMPT_TEMPLATE = `Chủ đề bài đăng: "{topic}"
{description_section}
Tone giọng: {tone}
Quy tắc: {rules}

(Hãy xuất thẳng nội dung bài viết hoàn chỉnh bằng 100% tiếng Việt, không kèm lời dẫn hay dàn ý):`;

export class GeminiService {
  private apiKey: string;
  public model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || '';
    this.model = this.cleanModelName(model || 'gemini-3.1-flash-lite');
  }

  static fromEnv(env: Env, configApiKey?: string, configModel?: string): GeminiService {
    const key = configApiKey || env.GEMINI_API_KEY || '';
    const model = configModel || env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    return new GeminiService(key, model);
  }

  private cleanModelName(model: string): string {
    return model.replace(/^models\//, '').trim();
  }

  /**
   * Lấy danh sách các model Gemini mà API Key của người dùng có quyền truy cập
   */
  async listAvailableModels(): Promise<string[]> {
    if (!this.apiKey) return [];

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await fetch(url);
      if (!response.ok) return [];

      const data: any = await response.json();
      const models = data.models || [];

      return models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => this.cleanModelName(m.name));
    } catch {
      return [];
    }
  }

  /**
   * Lọc sạch các bước suy nghĩ / dàn ý nháp nội bộ nếu model tự ý xuất ra
   */
  private cleanGeneratedContent(rawText: string): string {
    if (!rawText) return '';
    let text = rawText.trim();

    // 1. Loại bỏ các thẻ <thought>...</thought>
    text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

    // 1.5. Nếu model xuất dạng phân rã nhãn (* Title:, * Intro:, * Content:, * Outro/CTA:, * Hashtags:)
    const titleMatch = text.match(/\*\s*\*?Title:\*?\s*([^\n]+)/i);
    const introMatch = text.match(/\*\s*\*?Intro:\*?\s*([\s\S]+?)(?=\n\s*\*\s*\*?(?:Content|Body):)/i);
    const contentMatch = text.match(/\*\s*\*?(?:Content|Body):\*?\s*([\s\S]+?)(?=\n\s*\*\s*\*?(?:Outro|CTA|Outro\/CTA):)/i);
    const ctaMatch = text.match(/\*\s*\*?(?:Outro|CTA|Outro\/CTA):\*?\s*([\s\S]+?)(?=\n\s*\*\s*\*?Hashtags:)/i);
    const hashtagsMatch = text.match(/\*\s*\*?Hashtags:\*?\s*([^\n]+(?:\s*#[^\n]+)*)/i);

    if (titleMatch && contentMatch) {
      const parts = [
        titleMatch[1].trim(),
        introMatch ? introMatch[1].trim() : '',
        contentMatch[1].trim(),
        ctaMatch ? ctaMatch[1].trim() : '',
        hashtagsMatch ? hashtagsMatch[1].trim() : ''
      ].filter(Boolean);
      return parts.join('\n\n')
        .replace(/^\s*\*\s*\*?(?:CTA\s*\d*|Note):\*?\s*/gmi, '')
        .replace(/^["'“]|["'”]$/g, '')
        .trim();
    }

    // 2. Bóc lấy nội dung sau các tiêu đề đánh dấu bản hoàn chỉnh
    const refinedMatch = text.match(/(?:\*?\*?(?:Refining[^\n:]*|Refined[^\n:]*|Final Post|Bài viết hoàn chỉnh|Bản hoàn chỉnh|Nội dung bài đăng)[^\n:]*:\*?\*?\s*)([\s\S]+)/i);
    if (refinedMatch && refinedMatch[1] && refinedMatch[1].trim().length > 50) {
      text = refinedMatch[1].trim();
    }

    // 3. Nếu còn dính các gạch đầu dòng nháp (* Role:, * Goal:, * Option 1:, * Drafting:)
    if (text.startsWith('* Role:') || text.startsWith('* Goal:') || text.startsWith('* Topic:') || text.includes('* Drafting') || text.includes('* Option 1:')) {
      const lines = text.split('\n');
      let postStartIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Tìm dòng đầu tiên có emoji thể thao hoặc tiêu đề thật sự
        if (/^["'“]?[🏸🔥📢⚡🏆🎯💪🎉✨🚨]/.test(line) && !line.includes('Option') && !line.includes('Drafting') && !line.includes('Selection')) {
          postStartIndex = i;
          break;
        }
      }
      if (postStartIndex !== -1) {
        text = lines.slice(postStartIndex).join('\n').trim();
      }
    }

    // 4. Bỏ dấu ngoặc kép bọc quanh bài nếu có
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
      text = text.slice(1, -1).trim();
    }

    return text;
  }

  async generatePost(options: {
    topic: string;
    description?: string;
    tone?: string;
    customRules?: string;
    systemPrompt?: string;
    userPromptTemplate?: string;
  }): Promise<GeneratedPost> {
    if (!this.apiKey) {
      throw new Error('Chưa cấu hình GEMINI_API_KEY. Vui lòng thiết lập trong Cài đặt hệ thống.');
    }

    const tone = options.tone || 'năng động, vui tươi, hào hứng, tự nhiên, thân thiện';
    const rules = options.customRules || 'Sử dụng tiếng Việt tự nhiên, ngắt dòng thoáng, chèn icon/emoji thể thao sinh động, có lời kêu gọi hành động (CTA) như rủ bạn bè, đặt sân, bình luận. Kèm các hashtag #caulong #badminton #giaoluucaulong #sancau';

    // Sử dụng System Prompt tùy chỉnh của người dùng nếu có, ngược lại dùng mẫu chuẩn tối ưu
    const systemInstruction = (options.systemPrompt && options.systemPrompt.trim())
      ? options.systemPrompt.trim()
      : DEFAULT_SYSTEM_PROMPT;

    // Chuẩn bị User Prompt
    let prompt = '';
    const descText = options.description && options.description.trim() ? options.description.trim() : '';
    const descSection = descText ? `\nTHÔNG TIN QUAN TRỌNG CẦN ĐƯA VÀO BÀI VIẾT:\n${descText}\n` : '';

    if (options.userPromptTemplate && options.userPromptTemplate.trim()) {
      prompt = options.userPromptTemplate
        .replace(/\{topic\}/g, options.topic)
        .replace(/\{description_section\}/g, descSection)
        .replace(/\{description\}/g, descText)
        .replace(/\{tone\}/g, tone)
        .replace(/\{rules\}/g, rules);
    } else {
      prompt = `Chủ đề bài đăng: "${options.topic}"\n`;
      if (descSection) {
        prompt += descSection;
      }
      prompt += `\nTone giọng: ${tone}\nQuy tắc: ${rules}\n\n(Hãy xuất thẳng nội dung bài viết hoàn chỉnh bằng 100% tiếng Việt, không kèm lời dẫn hay dàn ý):`;
    }

    const requestBody: any = {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      }
    };

    // Thử gọi với model hiện tại
    try {
      const rawResult = await this.callGenerateApi(this.model, requestBody);
      const cleanContent = this.cleanGeneratedContent(rawResult);

      return {
        content: cleanContent,
        suggestedTags: this.extractTags(options.topic, cleanContent),
        topic: options.topic,
        usedModel: this.model
      };
    } catch (err: any) {
      // Nếu gặp lỗi (404 model không hỗ trợ, 500...), tự động dò tìm model hoạt động từ API Key
      const availableModels = await this.listAvailableModels();

      if (availableModels.length > 0) {
        // Ưu tiên các model Gemini chính thức của Google, loại trừ các model Gemma nếu có Gemini
        const geminiModelsOnly = availableModels.filter(m => !m.startsWith('gemma'));
        const prioritized = [
          'gemini-3.1-flash-lite',
          'gemini-flash-lite-latest',
          'gemini-3.5-flash',
          'gemini-3.7-flash',
          'gemini-3.8-flash',
          'gemini-flash-latest',
          'gemini-2.5-flash-lite',
          ...geminiModelsOnly,
          ...availableModels
        ];

        for (const fallbackModel of prioritized) {
          if (availableModels.includes(fallbackModel) && fallbackModel !== this.model) {
            try {
              const fallbackRaw = await this.callGenerateApi(fallbackModel, requestBody);
              const fallbackClean = this.cleanGeneratedContent(fallbackRaw);
              this.model = fallbackModel;
              return {
                content: fallbackClean,
                suggestedTags: this.extractTags(options.topic, fallbackClean),
                topic: options.topic,
                usedModel: fallbackModel
              };
            } catch {
              continue;
            }
          }
        }
      }
      throw err;
    }
  }

  async brainstormIdeas(options: {
    theme?: string;
    count?: number;
  }): Promise<{ topic: string; description: string }[]> {
    if (!this.apiKey) {
      throw new Error('Chưa cấu hình GEMINI_API_KEY. Vui lòng thiết lập trong Cài đặt hệ thống.');
    }

    const count = options.count || 5;
    const theme = options.theme || 'Thể thao cầu lông phong trào, đời sống lông thủ, kèo giao lưu, dịch vụ sân bãi';

    const prompt = `Bạn là chuyên gia marketing cho sân cầu lông. Hãy lên danh sách ${count} ý tưởng bài viết Facebook độc đáo, thu hút tương tác cho fanpage sân cầu lông.
Chủ đề định hướng: ${theme}

Yêu cầu: Trả về kết quả dưới dạng JSON Array thuần túy (không bọc trong markdown codeblock nếu có thể, hoặc bọc \`\`\`json):
[
  {
    "topic": "Tiêu đề ý tưởng ngắn gọn, súc tích",
    "description": "Mô tả ngắn góc nhìn hoặc gợi ý nội dung để viết"
  }
]`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9
      }
    };

    let rawText = '';
    try {
      rawText = await this.callGenerateApi(this.model, requestBody);
    } catch {
      const models = await this.listAvailableModels();
      const geminiModels = models.filter(m => !m.startsWith('gemma'));
      const tryList = [
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.5-flash',
        'gemini-3.7-flash',
        'gemini-3.8-flash',
        ...geminiModels,
        ...models
      ];
      for (const m of tryList) {
        if (models.includes(m) && m !== this.model) {
          try {
            rawText = await this.callGenerateApi(m, requestBody);
            this.model = m;
            break;
          } catch {
            continue;
          }
        }
      }
    }

    try {
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          topic: String(item.topic || 'Ý tưởng bài viết'),
          description: String(item.description || '')
        }));
      }
      return [];
    } catch {
      return rawText.split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 5)
        .slice(0, count)
        .map((l: string) => ({
          topic: l.replace(/^\d+[\.\-\)]\s*/, ''),
          description: 'Ý tưởng tự động từ Gemini'
        }));
    }
  }

  private async callGenerateApi(model: string, body: any): Promise<string> {
    const clean = this.cleanModelName(model);
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/${clean}:generateContent?key=${this.apiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/${clean}:generateContent?key=${this.apiKey}`
    ];

    let lastError: any = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          const data: any = await response.json();
          const candidate = data.candidates?.[0];
          const text = candidate?.content?.parts?.[0]?.text;
          if (text) return text;
        } else {
          const errText = await response.text();
          lastError = new Error(`Lỗi gọi Gemini API (${response.status}): ${errText}`);
          if (response.status !== 404) {
            throw lastError;
          }
        }
      } catch (e: any) {
        lastError = e;
        if (e.message && !e.message.includes('404')) throw e;
      }
    }

    throw lastError || new Error(`Không thể kết nối với Gemini model ${model}`);
  }

  private extractTags(topic: string, content: string): string[] {
    const defaultTags: string[] = ['san_bai'];
    const text = (topic + ' ' + content).toLowerCase();

    if (text.includes('giao lưu') || text.includes('kèo') || text.includes('tuyển')) defaultTags.push('giao_luu');
    if (text.includes('khuyến mãi') || text.includes('ưu đãi') || text.includes('giờ vàng') || text.includes('giảm giá')) defaultTags.push('khuyen_mai');
    if (text.includes('kỹ thuật') || text.includes('mẹo') || text.includes('vợt') || text.includes('cước') || text.includes('đập')) defaultTags.push('ky_thuat');
    if (text.includes('giải') || text.includes('thi đấu') || text.includes('vô địch')) defaultTags.push('giai_dau');

    return Array.from(new Set(defaultTags));
  }
}
