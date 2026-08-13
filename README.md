# PDF-ownWay
Dịch file PDF *ngắn, chuyên ngành* từ tiếng Anh sang tiếng Việt bằng **Meta AI**. Có khả năng giữ được ảnh &amp; công thức toán.

Link: https://pdf-ownway.wpsila.com

Ứng dụng cần API Key của Meta để chạy.

Phiên bản dành cho Meta AI này được phát triển dựa trên phiên bản (1.0.88) dành riêng cho Gemini: https://github.com/kiencang/PDF-silaTranslator-Online

## Tuyên bố từ chối trách nhiệm
Công cụ này có thể được sử dụng cho mục đích nghiên cứu và học tập cá nhân.

PDF-ownWay cũng như người phát triển nó không đưa ra bất kỳ bảo đảm rõ ràng hay ngụ ý nào, cũng như không tuyên bố rằng công cụ sẽ vận hành hoàn hảo, chính xác hoặc cập nhật. Người phát triển sẽ không chịu trách nhiệm cho bất kỳ tổn thất hay thiệt hại nào phát sinh trực tiếp hoặc gián tiếp liên quan đến hoặc phát sinh từ việc sử dụng công cụ này.

## Ghi công

Công cụ này được hoàn thành dựa vào nhiều thư viện khác. Một số thư viện quan trọng bao gồm:

### 1. Nền tảng
*   **[Angular](https://angular.dev/)**: Framework Javascript, sản phẩm của Google.
*   **[Tailwind CSS](https://tailwindcss.com/)**: Chịu trách nhiệm chính cho giao diện.
*   **[Lucide Angular](https://lucide.dev/)**: Bộ icon.

### 2. PDF core
*   **[pdf-lib](https://pdf-lib.js.org/)**: Giúp chia tách, cắt ngắn file PDF.
*   **[Mozilla PDF.js](https://mozilla.github.io/pdf.js/)** – Phát triển bởi **Mozilla**. Thư viện chạy hoàn toàn trên Client-side, giúp trích xuất hình ảnh trong file PDF.
