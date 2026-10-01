import { ChangeDetectionStrategy, Component, computed, input, ViewEncapsulation } from '@angular/core';
import { marked } from 'marked';

/**
 * Renders agent markdown. The HTML goes through [innerHTML], so Angular's sanitizer strips scripts
 * and unsafe attributes; never bypass it with bypassSecurityTrust*.
 */
@Component({
  selector: 'app-markdown-view',
  templateUrl: './markdown-view.html',
  styleUrl: './markdown-view.scss',
  host: { class: 'markdown-view' },
  // Styles must reach the generated HTML, which has no Angular attributes; rules are scoped by the block.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownView {
  readonly text = input.required<string>();

  protected readonly html = computed(
    () => marked.parse(this.text(), { async: false, gfm: true, breaks: true }) as string,
  );
}
