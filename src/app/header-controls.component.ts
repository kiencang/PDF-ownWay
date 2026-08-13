import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, FileText, Sparkles, Zap, Key } from 'lucide-angular';
import { SearchBarComponent } from './search-bar.component';

@Component({
  selector: 'app-header-controls',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, SearchBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bg-white border-b border-slate-200 relative z-40">
      <div class="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-0 lg:h-16 flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-center sm:justify-center lg:justify-between gap-3 sm:gap-4 lg:gap-0">
        
        <!-- Left side: Logo + Model Toggle -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 w-full lg:w-auto">
          
          <!-- Logo and Title -->
          <div class="flex items-center gap-2">
            <div class="bg-indigo-600 text-white p-1.5 rounded-lg shrink-0">
              <lucide-icon [img]="FileText" class="w-5 h-5" aria-hidden="true"></lucide-icon>
            </div>
            <div class="block">
              <h1 class="text-lg sm:text-xl font-bold font-display tracking-tight text-slate-900 leading-tight">
                PDF-ownWay
              </h1>
              <button 
                type="button"
                [disabled]="isProcessing"
                (click)="onOpenApiKeyModal()"
                title="{{ isProcessing ? 'Không thể cấu hình khi đang xử lý' : (hasUserApiKey ? 'Sửa API Key của bạn' : 'Cấu hình API Key của bạn') }}"
                class="flex items-center gap-1 text-[11px] font-medium mt-0.5 transition-colors focus:outline-none text-left"
                [class.cursor-not-allowed]="isProcessing"
                [class.cursor-pointer]="!isProcessing"
                [ngClass]="hasUserApiKey ? 'text-emerald-600 hover:text-emerald-700' : (isProcessing ? 'text-slate-400' : 'text-slate-500 hover:text-indigo-600 underline decoration-slate-300 hover:decoration-indigo-600 underline-offset-2')"
              >
                <lucide-icon [img]="Key" class="w-3 h-3"></lucide-icon>
                <span class="sm:hidden">{{ hasUserApiKey ? 'Đang dùng key của bạn' : 'Nhập API Key' }}</span>
                <span class="hidden sm:inline">{{ hasUserApiKey ? 'Đang dùng key của bạn' : 'Nhập (cấu hình) API Key' }}</span>
              </button>
            </div>
          </div>

          <!-- Model Indicator Badge -->
          <div class="flex items-center bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-inner">
            <div class="group relative flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
              <lucide-icon [img]="Sparkles" class="w-3.5 h-3.5 text-indigo-600"></lucide-icon>
              <span>{{ selectedModel }}</span>
              <!-- Custom Tooltip -->
              <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-64 p-2.5 bg-slate-800 text-slate-100 text-xs text-left rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none border border-slate-700 font-normal tracking-wide">
                Model AI mà bạn đang dùng trên ứng dụng này.
                <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 border-t border-l border-slate-700 rotate-45 transform origin-center"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Search Bar -->
        <div class="w-full lg:w-auto flex justify-center lg:justify-end mt-2 lg:mt-0">
          <app-search-bar [isProcessing]="isProcessing" class="w-full lg:w-auto"></app-search-bar>
        </div>
      </div>
    </header>
  `
})
export class HeaderControlsComponent {
  readonly FileText = FileText;
  readonly Sparkles = Sparkles;
  readonly Zap = Zap;
  readonly Key = Key;

  @Input() isProcessing = false;
  @Input() selectedModel = 'muse-spark-1.2';
  @Input() hasUserApiKey = false;
  
  @Output() modelChange = new EventEmitter<string>();
  @Output() openApiKeyModal = new EventEmitter<void>();

  onModelChange(model: string) {
    this.modelChange.emit(model);
  }

  onOpenApiKeyModal() {
    this.openApiKeyModal.emit();
  }
}
