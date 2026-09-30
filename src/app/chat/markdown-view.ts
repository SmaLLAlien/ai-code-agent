import { ChangeDetectionStrategy, Component, computed, input, ViewEncapsulation } from '@angular/core';
import { marked } from 'marked';

/**
 * Renders agent markdown. The HTML goes through [innerHTML], so Angular's sanitizer strips scripts
 * and unsafe attributes; never bypass it with bypassSecurityTrust*.
 */
@Component({
  selector: 'app-markdown-view',
  template: `<div class="md" [innerHTML]="html()"></div>`,
  styleUrl: './markdown-view.css',
  // Styles must reach the generated HTML, which has no Angular attributes; all rules are scoped by .md.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownView {
  readonly text = input.required<string>();

  protected readonly html = computed(
    () => marked.parse(this.text(), { async: false, gfm: true, breaks: true }) as string,
  );
}
