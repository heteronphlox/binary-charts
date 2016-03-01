import React, { Component, PropTypes } from 'react';
import * as lineData from '../../model/LineData';
import {createTitle} from '../../model/Title';
import {createXAxis, createYAxis} from '../../model/Axis';
import {createTooltip} from '../../model/Tooltip';
import BaseChart from '../BaseChart';
import * as dataUtil from '../../utils/DataUtils';
import * as rfDecorators from './RiseFallChartDecorators';

const riseFallToolTip = (width, height) => createTooltip({
    triggerOn: 'mousemove',
    trigger: 'axis',
    tooltipFormatter: (params) => {
        const param0 = params[0];
        const seriesName = param0.seriesName;
        const value = param0.value;
        return `${seriesName}<br />Time: ${value[0]}<br />Spot:${value[1]}`;
    },
    width,
    height,
});

const createContractFrame = (current, entry, exit, yMin, yMax) => {
    if (!entry) return undefined;
    const frameStartData = [[entry[0], yMin], [entry[0], yMax]];
    const frameEndData = exit ? [[exit[0], yMax], [exit[0], yMin]] : [[current[0], yMax], [current[0], yMin]];

    return frameStartData.concat(frameEndData.concat([frameStartData[0]]));
};

const createLegendForContracts = (contracts) => {
    const legendData = contracts.map(c => ([
        {name: c.id,},
        {name: `${c.id}'s entry spot`}
    ]));

    return {
        data: legendData.reduce((a, b) => a.concat(b))
    };
};

const epochFormatter = (precision = 's') => {
    switch (precision) {
        case 's': return epoch => (new Date(epoch * 1000)).toISOString().slice(11, 18);
            break;
        case 'd': return epoch => (new Date(epoch * 1000)).toISOString().slice(0, 10);
            break;
        default: {
            console.warn('Unexpected precision, fallback to seconds');
            return epoch => (new Date(epoch * 1000)).toISOString().slice(11, 18);
        }
    }
};

const spotFormatter = (precision = 2) => spot => spot.toFixed(precision);

export default class RiseFallChart extends Component {
    static defaultProps = {
        title: 'Rise/Fall Chart',
        xOffsetPercentage: 0.1,
        yOffsetPercentage: 0.7,
        xFormatter: epochFormatter(),
        yFormatter: spotFormatter(0),
    };

    static propTypes = {
        title: PropTypes.string,
        data: PropTypes.array,
        symbol: PropTypes.string,
        contracts: PropTypes.arrayOf(PropTypes.shape({
            id: PropTypes.string.isRequired,
            entry: PropTypes.array.isRequired,
            exit: PropTypes.array,
        })),
        xOffsetPercentage: PropTypes.number.isRequired,
        yOffsetPercentage: PropTypes.number.isRequired,
        xFormatter: PropTypes.func.isRequired,
        yFormatter: PropTypes.func.isRequired,
    };

    getEchartInstance(baseChart) {
        if (baseChart) {
            this.echart = baseChart.echart;
        }
    }

    render() {
        const {
            data,
            contracts,
            title,
            symbol,
            xOffsetPercentage,
            yOffsetPercentage,
            xFormatter,
            yFormatter,
            ...other} = this.props;

        if (!data) {
            return <div/>;
        }

        const xOffset = dataUtil.getXBoundaryInValue(data, xOffsetPercentage);
        const yOffset = dataUtil.getYBoundaryInValue(data, yOffsetPercentage);

        const xMin = data[0][0];
        const xMax = xOffset[1];
        const yMin = yOffset[0];
        const yMax = yOffset[1];

        const currentSpot = data[data.length - 1];
        const currentSpotData = [[xMin, currentSpot[1]], [xMax, currentSpot[1]]];

        const allContractsLegend = contracts && createLegendForContracts(contracts);

        const width = this.echart && this.echart.getWidth();
        const height = this.echart && this.echart.getHeight();

        const allContractsSeries = contracts && contracts.map(c => {
            const entry = c.entry;
            const exit = c.exit;
            const entrySpotData = entry && [[xMin, entry[1]], [xMax, entry[1]]];
            const contractFrameData = createContractFrame(currentSpot, entry, exit, yMin, yMax);

            const contractFrameSeries = contractFrameData && lineData.createSeriesAsLine(c.id, contractFrameData);
            const entrySpotSeries = entrySpotData && lineData.createSeriesAsLine(`${c.id}'s entry spot`, entrySpotData);

            const labeledEntrySpotSeries =
                this.echart ?
                rfDecorators.decorateHorizontalLineSeries({
                    series: entrySpotSeries,
                    width: width,
                    height: height,
                }) :
                rfDecorators.decorateHorizontalLineSeries({series: entrySpotSeries});

            const styledContractFrame =
                this.echart ?
                    rfDecorators.decorateContractFrame({
                        series: contractFrameSeries,
                        height: width,
                        width: height,
                        ended: !!exit
                    }) :
                    rfDecorators.decorateContractFrame({
                        series: contractFrameSeries,
                        ended: !!exit
                    });

            return [labeledEntrySpotSeries, styledContractFrame];
        });

        // convert to series
        const dataSeries = data && lineData.createSeriesAsLine(symbol, data);
        const currentSpotSeries = lineData.createSeriesAsLine('Current Spot', currentSpotData);

        // decorate with style
        const dataSeriesWithAreaStyle = lineData.decorateSeriesWithAreaStyle(dataSeries);
        const labeledCurrentSpotSeries =
            this.echart ?
                rfDecorators.decorateCurrentSpotLine({
                    series: currentSpotSeries,
                    height: height,
                    width: width,
                }) :
                rfDecorators.decorateCurrentSpotLine({series: currentSpotSeries});

        let series = [];
        if (dataSeries) series.push(dataSeriesWithAreaStyle);
        if (allContractsSeries && allContractsSeries.length > 0) {
            allContractsSeries.forEach(sr => {
                series = series.concat(sr);
            });
        }

        series.push(labeledCurrentSpotSeries);

        const tt = title && createTitle(title);

        const tooltip = this.echart ?
            riseFallToolTip(width, height) :
            riseFallToolTip();

        const xAxis = Object.assign({
            min: xMin,
            max: xMax,
            axisLabel: {
                formatter: xFormatter
            }
        }, createXAxis('Time'));

        const yAxis = Object.assign({
            min: yMin,
            max: yMax,
            axisLabel: {
                formatter: yFormatter
            }
        }, createYAxis('Spot'));

        return (
            <BaseChart
                {...other}
                title={tt}
                series={series}
                xAxis={xAxis}
                yAxis={yAxis}
                tooltip={tooltip}
                legend={allContractsLegend}
                ref={this.getEchartInstance.bind(this)}
            />
        );
    }
}
