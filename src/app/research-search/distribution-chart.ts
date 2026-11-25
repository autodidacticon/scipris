import { init, use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { DataZoomInsideComponent, DataZoomSliderComponent, GridComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([BarChart, GridComponent, DataZoomSliderComponent, DataZoomInsideComponent, TooltipComponent, SVGRenderer]);

export function createDistributionChart(element: HTMLElement, selectBar: (value: string) => void) {
  const chart = init(element, undefined, { renderer: 'svg' });
  chart.setOption({
    animation: false,
    color: ['#4437a5'],
    grid: { top: 14, bottom: 58, left: 42, right: 12 },
    tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', minInterval: 1 },
    dataZoom: [
      { type: 'slider', xAxisIndex: 0, height: 18, bottom: 6, brushSelect: false },
      { type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: 'ctrl', moveOnMouseMove: false },
    ],
    series: [{ type: 'bar', name: 'Papers', barMaxWidth: 32 }],
  });
  chart.on('click', 'series.bar', event => selectBar(event.name));
  return chart;
}
