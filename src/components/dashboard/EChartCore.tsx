import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';

// Only the pieces the dashboard uses are registered so the (lazy) chart chunk stays small.
echarts.use([BarChart, LineChart, PieChart, GridComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

type EChartCoreProps = {
    option: EChartsCoreOption;
    onClick?: () => void;
};

const EChartCore = ({ option, onClick }: EChartCoreProps) => (
    <ReactEChartsCore
        echarts={echarts}
        option={option}
        notMerge
        lazyUpdate
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas' }}
        onEvents={onClick ? { click: onClick } : undefined}
    />
);

export default EChartCore;
