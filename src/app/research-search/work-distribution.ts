import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import type { PublicationRange } from './publication-range';
import { aggregateLabels, type Distribution } from './work-analytics';
import type { createDistributionChart } from './distribution-chart';

@Component({
  selector: 'app-work-distribution',
  imports: [DecimalPipe],
  templateUrl: './work-distribution.html',
  styleUrl: './work-distribution.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkDistribution {
  readonly group = input.required<Distribution>();
  protected readonly label = computed(() => aggregateLabels[this.group().field]);
  protected readonly view = linkedSignal<'chart' | 'table'>(() => this.group().field === 'yearPublished' ? 'chart' : 'table');
  readonly canSelect = input(true);
  readonly rangeSelected = output<PublicationRange>();
  private readonly years = computed(() => {
    const group = this.group();
    return group.field === 'yearPublished' ? group.buckets : [];
  });
  private readonly known = computed(() => this.years()
    .filter((bucket): bucket is { year: number; count: number } => bucket.year !== null)
    .sort((a, b) => a.year - b.year));
  protected readonly unknown = computed(() => this.years().find(bucket => bucket.year === null)?.count);
  protected readonly rows = computed(() => {
    const group = this.group();
    return group.field === 'yearPublished'
      ? group.buckets.map(({ year, count }) => ({ value: String(year ?? 'Unknown year'), count }))
      : group.buckets;
  });
  private readonly bars = computed(() => this.group().field === 'yearPublished'
    ? this.known().map(({ year, count }) => ({ value: String(year), count }))
    : this.rows());
  protected readonly canChart = computed(() => !this.chartUnavailable() && this.bars().length > 0);
  protected readonly showChart = computed(() => this.canChart() && this.view() === 'chart');
  private firstYear?: number;
  protected readonly chartUnavailable = signal(typeof ResizeObserver === 'undefined');
  private readonly plot = viewChild<ElementRef<HTMLElement>>('plot');
  private readonly chart = signal<ReturnType<typeof createDistributionChart> | undefined>(undefined);

  constructor() {
    effect(onCleanup => {
      const element = this.plot()?.nativeElement;
      if (!element || typeof ResizeObserver === 'undefined') return;
      let active = true;
      let started = false;
      let instance: ReturnType<typeof createDistributionChart> | undefined;
      const observer = new ResizeObserver(async () => {
        if (!element.clientWidth) return;
        if (started) {
          instance?.resize();
          return;
        }
        started = true;
        try {
          const { createDistributionChart } = await import('./distribution-chart');
          if (!active) return;
          instance = createDistributionChart(element, year => this.selectBar(year));
          this.chart.set(instance);
        } catch {
          if (active) this.chartUnavailable.set(true);
        }
      });
      observer.observe(element);
      onCleanup(() => {
        active = false;
        observer.disconnect();
        this.chart.set(undefined);
        instance?.dispose();
      });
    });
    effect(() => {
      const bars = this.bars();
      this.chart()?.setOption({
        xAxis: { data: bars.map(bucket => bucket.value) },
        series: [{ data: bars.map(bucket => bucket.count) }],
      });
    });
  }

  private selectBar(year: string) {
    if (!this.canSelect() || this.group().field !== 'yearPublished') return;
    const selected = Number(year);
    if (this.firstYear === undefined) {
      this.firstYear = selected;
      return;
    }
    const low = Math.min(this.firstYear, selected);
    const high = Math.max(this.firstYear, selected);
    this.firstYear = undefined;
    this.rangeSelected.emit({
      from: String(low).padStart(4, '0') + '-01-01',
      to: String(high).padStart(4, '0') + '-12-31',
    });
  }
}
