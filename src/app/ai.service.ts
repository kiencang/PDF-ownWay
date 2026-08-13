import { Injectable } from '@angular/core';
import OpenAI from 'openai';

export interface TranslationResult {
  text: string;
  usageMetadata?: unknown;
}

export interface ApiContentPart {
  type: string;
  file_data?: string;
  mime_type?: string;
  text?: string;
}

export interface ApiInputMessage {
  role: string;
  content: string | ApiContentPart[];
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  readonly MODEL_NAME_DEFAULT = 'muse-spark-1.2';

  private getApiKey(): string {
    if (typeof localStorage !== 'undefined') {
      const userKey = localStorage.getItem('ownway_meta_api_key') || localStorage.getItem('sila_pdf_translator_user_api_key');
      if (userKey && userKey.trim() !== '') {
        return userKey.trim();
      }
    }
    throw new Error('Vui lòng thiết lập "API Key Meta AI" trong phần "Nhập API Key" để sử dụng ứng dụng.');
  }

  private getOpenAIClient(): OpenAI {
    return new OpenAI({
      apiKey: this.getApiKey(),
      baseURL: 'https://api.meta.ai/v1',
      dangerouslyAllowBrowser: true
    });
  }

  async countTokens(
    fileData: string, 
    mimeType: string = 'text/plain', 
    modelName: string = this.MODEL_NAME_DEFAULT,
    pageCount: number = 1
  ): Promise<number> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      if (mimeType === 'application/pdf') {
        return pageCount * 500;
      }
      return Math.ceil((fileData || '').length / 4);
    }
    
    try {
      const endpoint = 'https://api.meta.ai/v1/responses/input_tokens';
      let contentPart: Record<string, unknown>;

      if (mimeType === 'application/pdf') {
        contentPart = {
          type: 'input_file',
          file_data: fileData,
          mime_type: 'application/pdf'
        };
      } else if (mimeType.startsWith('image/')) {
        contentPart = {
          type: 'image_url',
          image_url: {
            url: fileData.startsWith('data:') ? fileData : `data:${mimeType};base64,${fileData}`
          }
        };
      } else {
        contentPart = {
          type: 'input_text',
          text: fileData || ' '
        };
      }

      const bodyPayload = {
        model: modelName,
        input: [
          {
            role: 'user',
            content: [contentPart]
          }
        ]
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        if (mimeType === 'application/pdf') {
          return pageCount * 500;
        }
        return Math.ceil((fileData || '').length / 4);
      }
      
      const data = await response.json() as Record<string, unknown>;
      let tokens = 0;
      if (typeof data['input_tokens'] === 'number') {
        tokens = data['input_tokens'];
      } else if (typeof data['tokens'] === 'number') {
        tokens = data['tokens'];
      } else if (data['usage'] && typeof (data['usage'] as any)['prompt_tokens'] === 'number') {
        tokens = (data['usage'] as any)['prompt_tokens'];
      } else if (data['input_token_count'] && typeof data['input_token_count'] === 'number') {
        tokens = data['input_token_count'];
      } else {
        if (mimeType === 'application/pdf') {
          return pageCount * 500;
        }
        return Math.ceil((fileData || '').length / 4);
      }
      return tokens;
    } catch (e: unknown) {
      console.warn('[Meta AI countTokens fallback]:', e);
      if (mimeType === 'application/pdf') {
        return pageCount * 500;
      }
      return Math.ceil((fileData || '').length / 4);
    }
  }

  private async callMetaApi(
    systemInstruction: string,
    contentParts: ApiContentPart[],
    modelName: string = this.MODEL_NAME_DEFAULT
  ): Promise<TranslationResult> {
    const openai = this.getOpenAIClient();

    // Prepare OpenAI Chat Completions content parts
    const userMessageParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    for (const part of contentParts) {
      if (part.type === 'text' && part.text) {
        userMessageParts.push({
          type: 'text',
          text: part.text
        });
      } else if (part.file_data) {
        const mime = part.mime_type || 'image/png';
        if (mime.startsWith('image/')) {
          const url = part.file_data.startsWith('data:')
            ? part.file_data
            : `data:${mime};base64,${part.file_data}`;
          userMessageParts.push({
            type: 'image_url',
            image_url: {
              url: url
            }
          });
        } else if (mime === 'text/html' || mime.startsWith('text/')) {
          let textStr = '';
          try {
            textStr = atob(part.file_data);
          } catch {
            textStr = part.file_data;
          }
          if (textStr) {
            userMessageParts.push({
              type: 'text',
              text: textStr
            });
          }
        } else {
          // Document / PDF file
          userMessageParts.push({
            type: 'input_file',
            file_data: part.file_data,
            mime_type: mime
          } as unknown as OpenAI.Chat.Completions.ChatCompletionContentPart);
        }
      }
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (systemInstruction) {
      messages.push({
        role: 'system',
        content: systemInstruction
      });
    }

    messages.push({
      role: 'user',
      content: userMessageParts.length === 1 && userMessageParts[0].type === 'text'
        ? userMessageParts[0].text
        : (userMessageParts as unknown as string)
    });

    console.log('[Meta AI Request] Messages count:', messages.length, 'Model:', modelName);

    // Try 1: OpenAI SDK Chat Completions
    try {
      const completion = await openai.chat.completions.create({
        model: modelName || this.MODEL_NAME_DEFAULT,
        messages: messages,
        temperature: 1.0,
        top_p: 1.0
      });

      console.log('[Meta AI Response - Chat Completions Raw]:', completion);

      const text = completion.choices?.[0]?.message?.content || '';
      if (text) {
        return {
          text,
          usageMetadata: completion.usage
        };
      }
    } catch (chatErr: unknown) {
      console.warn('[Meta AI Chat Completions Error]:', chatErr);
    }

    // Try 2: Fetch /v1/responses endpoint directly with full raw response logging
    const apiKey = this.getApiKey();
    const endpoint = 'https://api.meta.ai/v1/responses';

    const inputMessages: ApiInputMessage[] = [];
    if (systemInstruction) {
      inputMessages.push({
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: systemInstruction
          }
        ]
      });
    }

    const formattedParts = contentParts.map(part => {
      if (part.type === 'text') {
        return {
          type: 'input_text',
          text: part.text || ''
        };
      }
      const mime = part.mime_type || 'application/octet-stream';
      if (mime.startsWith('image/')) {
        const url = part.file_data?.startsWith('data:') ? part.file_data : `data:${mime};base64,${part.file_data}`;
        return {
          type: 'input_image',
          image_url: url
        };
      }
      return {
        type: 'input_file',
        file_data: part.file_data,
        mime_type: mime
      };
    });

    inputMessages.push({
      role: 'user',
      content: formattedParts
    });

    const bodyPayload = {
      model: modelName || this.MODEL_NAME_DEFAULT,
      input: inputMessages,
      temperature: 1.0,
      top_p: 1.0,
      max_output_tokens: 100000,
      reasoning: { effort: 'high' }
    };

    console.log('[Meta AI Responses Payload]:', bodyPayload);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        let errText = '';
        try {
          const errJson = await response.json() as Record<string, unknown>;
          const errObj = errJson['error'] as Record<string, unknown> | undefined;
          errText = (errObj?.['message'] as string) || (errJson['message'] as string) || JSON.stringify(errJson);
        } catch {
          errText = await response.text();
        }
        console.error('[Meta AI Error Response]:', response.status, errText);
        throw new Error(`Meta AI API Error (${response.status}): ${errText}`);
      }

      const resData = await response.json() as Record<string, unknown>;
      console.log('[Meta AI Responses Raw Output]:', resData);

      let textOutput = '';
      if (typeof resData['output_text'] === 'string' && resData['output_text'].trim()) {
        textOutput = resData['output_text'];
      } else if (Array.isArray(resData['output']) && resData['output'].length > 0) {
        const messageOutput = resData['output'].find((out: any) => out?.type === 'message' && out?.role === 'assistant');
        if (messageOutput && Array.isArray(messageOutput.content)) {
          textOutput = messageOutput.content.map((c: any) => c.text || c.val || c.content || '').join('');
        }
        
        if (!textOutput) {
          const firstOut = resData['output'][0] as unknown;
          if (typeof firstOut === 'string') {
            textOutput = firstOut;
          } else if (firstOut && typeof firstOut === 'object' && 'content' in firstOut) {
            const content = (firstOut as { content: unknown }).content;
            if (typeof content === 'string') {
              textOutput = content;
            } else if (Array.isArray(content)) {
              textOutput = content.map((c: Record<string, unknown>) => (c['text'] || c['val'] || c['content'] || '') as string).join('');
            }
          }
        }
      } else if (Array.isArray(resData['choices']) && resData['choices'][0]?.message?.content) {
        textOutput = (resData['choices'][0] as { message: { content: string } }).message.content;
      } else if (typeof resData['text'] === 'string') {
        textOutput = resData['text'];
      }

      if (!textOutput) {
        const rawJsonString = JSON.stringify(resData);
        console.error('[Meta AI No Text Output Found] Full Raw JSON:', rawJsonString);
        throw new Error(`Meta AI trả về phản hồi rỗng/không tìm thấy nội dung văn bản. Chi tiết phản hồi API: ${rawJsonString.substring(0, 300)}...`);
      }

      return {
        text: textOutput,
        usageMetadata: resData['usage'] || resData['usageMetadata'] || {
          input_tokens: resData['input_tokens'] ?? resData['input_token_count'],
          output_tokens: resData['output_tokens'] ?? resData['output_token_count'],
          total_tokens: resData['total_tokens'] ?? resData['total_token_count']
        }
      };
    } catch (e: unknown) {
      if (e instanceof Error) {
        throw new Error(e.message);
      }
      throw new Error('Lỗi không xác định khi gọi Meta AI API');
    }
  }

  async translate(
    fileData: string,
    mimeType: string,
    prompt: string,
    systemInstruction: string,
    modelName: string = this.MODEL_NAME_DEFAULT,
    images: {id: string, dataUrl: string}[] = []
  ): Promise<TranslationResult> {
    const parts: ApiContentPart[] = [];
    const cleanFileData = fileData.includes(',') ? fileData.split(',')[1] : fileData;

    // Main document attachment
    parts.push({
      type: 'file_data',
      file_data: cleanFileData,
      mime_type: mimeType
    });

    // Extracted JPEG images from PDF
    for (const img of images) {
      if (img.dataUrl.includes(',')) {
        const mime = img.dataUrl.split(';')[0].split(':')[1];
        const data = img.dataUrl.split(',')[1];
        parts.push({
          type: 'file_data',
          file_data: data,
          mime_type: mime
        });
        parts.push({
          type: 'text',
          text: `(This extracted image has ID: ${img.id})`
        });
      }
    }

    // User prompt
    parts.push({
      type: 'text',
      text: prompt
    });

    return this.callMetaApi(systemInstruction, parts, modelName);
  }

  async translateHtml(
    htmlContent: string,
    prompt: string,
    systemInstruction: string,
    modelName: string = this.MODEL_NAME_DEFAULT,
    images: {id: string, dataUrl: string}[] = []
  ): Promise<TranslationResult> {
    const parts: ApiContentPart[] = [];
    const cleanHtmlContent = htmlContent.includes(',') ? htmlContent.split(',')[1] : htmlContent;

    parts.push({
      type: 'file_data',
      file_data: cleanHtmlContent,
      mime_type: 'text/html'
    });

    if (images && images.length > 0) {
      const ids = images.map(img => img.id).join(', ');
      parts.push({
        type: 'text',
        text: `Tài liệu HTML này chứa các hình ảnh có ID sau: [${ids}]. Nhiệm vụ của bạn là giữ nguyên các thẻ <img> và thuộc tính src tương ứng của chúng trong mã HTML kết quả.`
      });
    }

    parts.push({
      type: 'text',
      text: prompt
    });

    return this.callMetaApi(systemInstruction, parts, modelName);
  }

  async translateSingleImageToHtml(dataUrl: string, modelName: string = this.MODEL_NAME_DEFAULT): Promise<string> {
    const systemInstruction = `Bạn là một chuyên gia thiết kế web, UI/UX và phiên dịch.
Người dùng gửi cho bạn một hình ảnh.
Nhiệm vụ 1: Đánh giá xem hình ảnh này có phải là sơ đồ, biểu đồ, hình vẽ kỹ thuật, hay bất kỳ hình thức nào chứa văn bản cần dịch không. Nếu đây là ảnh chụp thông thường (chân dung, phong cảnh, động vật, nhà cửa, v.v.) không chứa nội dung cần dịch, hãy trả về CHÍNH XÁC chuỗi: [REJECT].
Nhiệm vụ 2: Nếu hình ảnh hợp lệ, hãy tái tạo lại hình ảnh đó bằng HTML và CSS một cách chính xác và thẩm mỹ nhất. Dịch tất cả văn bản trong hình sang Tiếng Việt.
YÊU CẦU KỸ THUẬT QUAN TRỌNG:
1. Tính tương thích (Responsive): Cấu trúc tạo ra phải co giãn tốt. TUYỆT ĐỐI KHÔNG thiết lập chiều rộng cố định (như width: 800px) gây tràn khung. Dùng \`max-width: 100%\`, \`width: 100%\`, \`box-sizing: border-box\`, và các đơn vị tương đối (%, rem, em). Đảm bảo tuyệt đối KHÔNG xuất hiện thanh cuộn ngang.
2. Bố cục thông minh: Ưu tiên sử dụng Flexbox hoặc CSS Grid để xây dựng bố cục sơ đồ, biểu đồ mạch lạc. Tránh lạm dụng \`position: absolute\` trừ khi thực sự cần thiết (như chú thích điểm ảnh), giúp cấu trúc linh hoạt trên mọi kích thước màn hình.
3. Typography & UI: Sử dụng \`font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;\` để văn bản hiển thị hiện đại, chuyên nghiệp. Điều chỉnh \`font-size\`, \`line-height\` và \`padding\` linh hoạt sao cho nội dung tiếng Việt dễ đọc, không bị che khuất hoặc tràn khỏi container.
4. Màu sắc & Hình khối: Cố gắng mô phỏng trung thực (hoặc cải thiện để đẹp mắt hơn) màu sắc nền, độ tương phản chữ, border-radius, border, và shadow từ ảnh gốc để kết quả trông sắc nét và chuyên nghiệp.
Chỉ trả về mã HTML (được phép bao gồm thẻ <style> bên trong, không chứa markdown như \`\`\`html), không giải thích gì thêm.`;

    const mime = dataUrl.split(';')[0].split(':')[1];
    const data = dataUrl.split(',')[1];

    const parts: any[] = [
      {
        type: 'file_data',
        file_data: data,
        mime_type: mime
      },
      {
        type: 'text',
        text: "Hãy tái tạo và dịch hình ảnh này sang HTML/CSS. Nếu không phải hình cần dịch, trả về [REJECT]."
      }
    ];

    const result = await this.callMetaApi(systemInstruction, parts, modelName);
    return result.text;
  }

  async translateSearchQuery(query: string, searchModel: string = this.MODEL_NAME_DEFAULT): Promise<string> {
    const systemInstruction = `Bạn là một AI chuyên dịch truy vấn tìm kiếm (search queries) từ tiếng Việt sang Tiếng Anh. Nhiệm vụ DUY NHẤT của bạn là trả về MỘT (1) truy vấn tìm kiếm tiếng Anh hiệu quả nhất, dựa trên đánh giá của bạn về ý định (search intent) và cách tìm kiếm phổ biến nhất trong tiếng Anh.

QUY TẮC BẮT BUỘC TUÂN THỦ:
1.  **CHỈ MỘT KẾT QUẢ:** Luôn luôn và chỉ luôn trả về DUY NHẤT MỘT chuỗi văn bản là bản dịch truy vấn tốt nhất. KHÔNG được đưa ra nhiều lựa chọn.
2.  **CHỈ VĂN BẢN THUẦN TÚY:** Kết quả trả về CHỈ BAO GỒM văn bản tiếng Anh đã dịch. TUYỆT ĐỐI KHÔNG thêm bất kỳ lời chào, lời giải thích, ghi chú, dấu ngoặc kép bao quanh, định dạng markdown, hoặc bất kỳ ký tự/từ ngữ nào khác ngoài chính truy vấn đã dịch.
3.  **ƯU TIÊN HIỆU QUẢ TÌM KIẾM HỌC THUẬT:** Mục tiêu là tạo ra truy vấn mà các nhà nghiên cứu, sinh viên thực sự sẽ gõ vào máy tìm kiếm tài liệu khoa học (như Google Scholar). Ưu tiên thuật ngữ chuyên ngành (academic terminology), danh từ cốt lõi, và các từ khóa nghiên cứu phổ biến.
4.  **ĐỘ CHÍNH XÁC VỀ Ý ĐỊNH:** Nắm bắt chính xác nhất ý định đằng sau truy vấn gốc tiếng Việt.
5.  **ĐỊNH DẠNG ĐẦU RA:** Đảm bảo đầu ra là một chuỗi văn bản thuần túy (plain text string) duy nhất.`;

    const prompt = `Provide the single best English search query translation for the following Vietnamese query. Output ONLY the raw English text, nothing else: ${query}`;
    const parts: any[] = [{ type: 'text', text: prompt }];

    const result = await this.callMetaApi(systemInstruction, parts, searchModel);
    return (result.text || '').trim();
  }

  public parseError(e: unknown): string {
    const errorMessage = e instanceof Error ? e.message : String(e);
    if (!errorMessage) {
      return 'Lỗi không xác định';
    }

    try {
      if (errorMessage.includes('{') && errorMessage.includes('}')) {
        const startIdx = errorMessage.indexOf('{');
        const endIdx = errorMessage.lastIndexOf('}') + 1;
        const jsonPart = errorMessage.substring(startIdx, endIdx);
        const parsed = JSON.parse(jsonPart);
        if (parsed.error?.message) {
          return parsed.error.message;
        } else if (parsed.message) {
          return parsed.message;
        }
      }
    } catch {
      // Ignored
    }

    return errorMessage;
  }
}


