/*
 * author: Leven
 * 依赖于 JQuery 1.8+
 * Create 15/12/2016
 * Version 1.0.0
 * demo:
 *      使用: $('#tableId').quickGrid({
 *                  。。。
 *              });
 * 外部调用函数方法:
 *      使用方法: $('#tableId').quickGrid({。。。}).quickGrid('方法名', [参数1], [参数2]...)；
 * 获取已选中的行数据:            getGridInfoBySelected
 * 通过id组获取行数据:            getGridInfoByIds(接收ID组)
 * 获取统计值列:                 getTotalColNum
 * 获取表格内全部数据:            getGridRowDatas
 * 新增, 不建议在循环中使用:       addNewRow(数据, 要被插入ID值)
 * 重载grid:                    reloadGrid()
 * 设置表尾统计值:               setFootRowValue({列的键值对})
 * 设置选中行:                  setSelectionRow(行id, 是否选中)
 * 清空Grid:                   cleanGridRow()
 * 根据ID删除指定行数据:         deleteGridRowDataByIds(id值)
 * 设置单元格具体值:             setGridCell(行id, 列名, 值)
 * 
 */
(function ($, window, document, undefined) {
    'use strict';

    // 私有属性
    var _param = {
        _pluginName: 'quickGrid',
        _tableHead: 'qgbox-quickgrid-hdiv',
        _tableBody: 'qgbox-quickgrid-bdiv',
        _tableFoot: 'qgbox-quickgrid-fdiv',
        _firstAction: true
    };

    // 表格模板
    function quickGridTemplate(boxId, width) {
        var templateHtml = ''
            + '<div id="qgbox_'+ boxId +'" class="qgbox-layout" style="width: '+ width +'px;">'
            +   '<div class="'+ _param._tableHead +'" style="width: '+ width +'px;">'
            +       '<div class="qgbox-outside-box">'
            +           '<table class="qgbox-htable" cellSpacing="0"><thead><tr></tr></thead></table>'
            +       '</div>'
            +   '</div>'
            +   '<div class="'+ _param._tableBody +'" style="width: '+ width +'px;">'
            +       '<div>'
            +           '<table id="'+ boxId +'" class="qgbox-btable" cellSpacing="0"></table>'
            +       '</div>'
            +    '</div>'
            +   '<div class="'+ _param._tableFoot +'" style="position: relative;width: '+ (width - 15) +'px;">'
            +       '<div class="qgbox-outside-box">'
            +           '<table class="qgbox-ftable" cellSpacing="0"><tr class="footrow"></tr></table>'
            +       '</div>'
            +   '</div>'
            + '</div>';

        return templateHtml;
    }

    $.fn.quickGrid = function (options) {
        var args = arguments
            , result = void 0;

        if (this.length == 0)
            return this;

        this.each(function () {
            var thisEle = this
                , instance = $(thisEle).data(_param._pluginName);

            if (typeof options == 'string') {
                Array.prototype.shift.call(args);
                if (instance && instance[options])
                    result = instance[options].apply(instance, args);
            }else if (typeof options == 'object' || !Boolean(options)){
                // 如果没有保存实例
                if (!instance) {
                    instance = new $.quickGrid(thisEle, options);
                    $(thisEle).data(_param._pluginName, instance);
                }
            }
        });
        return void 0 === result ? this : result;
    };

    // 构造主函数
    $.quickGrid = function (selsector, configs) {
        this.Elm = $(selsector);
        this.ElmParent = this.Elm.parent();
        this.ElmId = this.Elm[0].id;
        this.ElmBox = '#qgbox_' + this.Elm[0].id;
        this.options = $.extend(true, {}, $.quickGrid.defaults, configs);
        this.ElmWidth = this.Elm.parent().outerWidth();
        this.defTemp = $(quickGridTemplate(this.ElmId, this.ElmWidth));
        this._tableHeadSelector = this.ElmBox + ' .qgbox-quickgrid-hdiv';
        this._tableBodySelector = this.ElmBox + ' .qgbox-quickgrid-bdiv';
        this._tableFootSelector = this.ElmBox + ' .qgbox-quickgrid-fdiv';
        this.selectedByIds = [];
        this.totalMap = {};
        this._privateFunc = $.quickGrid._privateFunc;
        this._init.apply(this, arguments);
    };

    $.quickGrid.prototype = {
        constructor: $.quickGrid,

        _init: function(){
            this._firstAction = true;
            this._setFormatColumnMap();
            this._buildBox();
            this._layout();
            this._privateFunc._deleteById();
        },

        // 构建表格模型（表头、表尾）
        _buildBox: function(){
            var _this = this
                , _hdiv = ''
                , _fdiv = ''
                , width
                , colModel = _this.options.colModel
                , align, hidden
                , hstyle = [], thName = [], bstyle = [];

            // 建立表身
            if(_this.options.dataType != 'local' && Boolean(_this.options.url)){
                $.ajax($.extend({
                    url: _this.options.url,
                    type: 'post',
                    dataType: 'json' ,
                    data: {},
                    success:function(data) {
                        $(_this).triggerHandler("jqGridLoadComplete", data);
                        _this.gridDataInfo = data;
                    }
                },_this.options.ajaxOptions));
            }else if(_this.options.dataType == 'local'){
                try{
                    _this.gridDataInfo = _this.options.localData;
                }catch(err){
                    console.log(err);
                }
            }

            // 特殊列
            colModel.unshift({
                name: "rn",
                width: 25
            },{
                name: "cb",
                label: '<input role="checkbox" id="'+ this.ElmId +'_cb" class="cbox" type="checkbox">',
                width: 20
            });

            // 建立表头、表尾
            if(colModel.length > 2){
                for(var x = 0; x < colModel.length; x++){
                    thName[x] = this.ElmId + '_' + colModel[x].name;
                    align = Boolean(colModel[x].align) ? 'text-align: '+ colModel[x].align +';' : '';
                    hidden = Boolean(colModel[x].hidden) ? 'display: none;' : '';
                    width = Boolean(colModel[x].width) ? 'width: '+ colModel[x].width +'px;' : '';
                    hstyle[x] = width + hidden;
                    bstyle[x] = width + hidden + align;
                    _hdiv += '<th'+ (hstyle[x] != '' ? ' style="'+ hstyle[x] +'"' : '') +'>'
                        +     '<div class="qgh_'+ thName[x] +'">'
                        +         (colModel[x].label || '')
                        +         '<span class="desc" '+ (colModel[x].sortable == true ? '' : ' style="display: none;"') +' data-column="'+ colModel[x].name +'">'
                        +           '<i class="s-ico qgbox-layout-ico-sort qgbox-ico-sort-asc"></i>'
                        +           '<i class="s-ico qgbox-layout-ico-sort qgbox-ico-sort-desc"></i>'
                        +         '</span>'
                        +     '</div>'
                        +  '</th>';

                    _fdiv += '<td data-column="'+ colModel[x].name +'"'+ (bstyle[x] != '' ? ' style="'+ bstyle[x] +'"' : '') +'></td>';
                }
                _this.defTemp.find('.qgbox-htable tr').append(_hdiv).end().find('.qgbox-ftable tr').append(_fdiv);
                if(!_this.options.footerRow){
                    _this.defTemp.find('.' + _param._tableFoot).hide();
                }
                _this.colModel = colModel;
                _this.thName = thName;
                _this.bstyle = bstyle;
                _this.allCheckBtn = _this.ElmId + '_cb';
                _this._bulidGridBody(_this.defTemp, colModel, thName, bstyle);
            }
        },

        // 构建表身
        _bulidGridBody: function($selector, colModel, thName, bstyle, newGridDataInfo){
            var _this = this
                , gridDataInfo = newGridDataInfo || _this.gridDataInfo
                , _bdiv = ''
                , isFirstRun = _this._firstAction
                , firstRunNum = _this.options.firstRunNum
                , forNum = gridDataInfo.length
                , $bTable = $selector.find('.qgbox-btable');

            _this._verifyParam(gridDataInfo);

            if(firstRunNum != 0)
                forNum = firstRunNum;
            for(var y = 0; y < forNum; y++){
                var _bdiv_td = ''
                    , itemId = gridDataInfo[y].id;

                for(var x = 0; x < colModel.length; x++){
                    var tdName;

                    if(gridDataInfo[y][colModel[x].name] == undefined){
                        if(colModel[x].name == 'cb'){
                            tdName = '<input role="checkbox" id="qgh_'+ this.ElmId +'_'+ itemId +'" class="cbox" type="checkbox" data-id="'+ itemId +'">';
                        }else if(colModel[x].name == 'rn'){
                            tdName = y + 1;
                        }else{
                            // 用户自定义
                            tdName = ''
                        }
                    }else{
                        var tdText = gridDataInfo[y][colModel[x].name];
                        // 格式化数据
                        tdName = _this._formatColumnVal(colModel[x].name, tdText);
                    }
                    _bdiv_td += '<td data-unformatvalue="'+ (tdText || '') +'" data-name="'+ colModel[x].name +'"'+ (bstyle[x] != '' ? ' style="'+ bstyle[x] +'"' : '') +'>'+ tdName +'</td>';

                }
                _bdiv += '<tr id="'+ itemId +'">'+ _bdiv_td +'</tr>'
            }
            $bTable.html(_bdiv);
            if(!$bTable.data(_param._pluginName))
                $bTable.data(_param._pluginName, _this);
            if(!isFirstRun)
                _this._bindEvent();
        },

        // 基础样式渲染
        _layout: function(){
            var _this = this;

            if(_this.options.autoWidth)
                _this.defTemp.find('table:not(#'+ _this.ElmId +')').css('width', _this.ElmWidth - 16).end()
                    .find('#'+ _this.ElmId).css('width', _this.ElmWidth - 17);
            _this.defTemp.find('.' + _param._tableBody).height(_this.options.gridHeight || 300);
            _this.Elm.replaceWith(_this.defTemp[0]);
            if(_this._firstAction){
                _this._bindEvent();
                _this._firstAction = false;
            }
        },

        // 事件绑定
        _bindEvent: function(){
            var _this = this
                , $allChecked = $('#' + _this.allCheckBtn);

            // 行勾选事件
            $(_this._tableBodySelector).off('click.quickGrid').on('click.quickGrid', function(e){
                var target = e.target || e.srcElement
                    , $target = $(target)
                    , $input = ($target[0].tagName == 'INPUT' ? $target : $target.closest('tr').find('input[type=checkbox]'))
                    , isChecked = $input.is(':checked');

                if($input.length != 0){
                    $allChecked.attr('checked', false);
                    $target[0].tagName == 'INPUT' ? null : $input.prop('checked', !isChecked);
                    _this._getGridInfoBySelected.call($input, _this.selectedByIds);
                    // 选中后事件callback
                    if(typeof _this.options.onSelectGridRow != 'undefined'){
                        _this.options.onSelectGridRow($input.data('id'), $input.is(':checked'));
                    }
                    // 计算金额
                    _this._totalColNum(true);
                }
            });
            // 滚动条同步
            $(_this._tableBodySelector).off('scroll.quickGrid').on('scroll.quickGrid',function() {
                $('.' + _param._tableHead + ', .' + _param._tableFoot).scrollLeft($(this).scrollLeft());
            });
            // 全选事件
            _this._allCheckedEvent();
            // 排序事件
            $(_this._tableHeadSelector).off('click.quickGrid').on('click.quickGrid', function(e){
                var target = e.target || e.srcElement
                    , $target = $(target);

                if($target[0].tagName == 'I'){
                    var $span = $target.parent('span')
                        , column = $span.attr('data-column');

                    if($span.hasClass('sort')){
                        _this._sortGrid('desc', column);
                        $span.find('.qgbox-ico-sort-desc').addClass('active');
                        $span.find('.qgbox-ico-sort-asc').removeClass('active');
                    }else{
                        _this._sortGrid('asc', column);
                        $span.find('.qgbox-ico-sort-asc').addClass('active');
                        $span.find('.qgbox-ico-sort-desc').removeClass('active');
                    }
                    $span.toggleClass('sort');
                }
            });
            // 窗口变化自适应表格
            _this.resizeWidth();

        },

        // 滚动加载方法实现（大数据, 默认开启, 待完善）
        scrollLoadAddRowInfo: function(){
            var range = 5
                , totalheight = 0;

            $(this.ElmBox).off('scroll').on('scroll', function(){
                var _this = $(this)
                    , srollPos = _this.scrollTop();    //滚动条距顶部距离(页面超出窗口的高度)

                totalheight = parseFloat(_this.height()) + parseFloat(srollPos);
                if(srollPos > 0 && (_this.height() - range) <= totalheight  && i < runTime) {
                    // appendData();
                }
            });
        },

        // 获取已选中的行数据
        getGridInfoBySelected: function(){
            var _this = this;

            return _this.getGridInfoByIds(_this.selectedByIds);
        },

        // 通过id组获取行数据
        getGridInfoByIds: function(IdsArray){
            var _this = this
                , dataInfos = _this.gridDataInfo
                , dataInfoBySelected = [];

            _this._verifyParam(IdsArray);
            if(typeof IdsArray === 'string')
                IdsArray = Array.prototype.slice.call(arguments);
            for(var x in IdsArray){
                if(IdsArray.hasOwnProperty(x)){
                    for(var y = 0; y < dataInfos.length; y++){
                        if(IdsArray[x] == dataInfos[y].id){
                            dataInfoBySelected.push(dataInfos[y]);
                            break;
                        }
                    }
                }
            }
            return dataInfoBySelected;
        },

        // 获取统计值列
        getTotalColNum: function(){
            return this.totalMap;
        },

        // 获取表格内全部数据
        getGridRowDatas: function(){
            return this.gridDataInfo;
        },

        // 获取 选中/取消 后行ID组
        _getGridInfoBySelected: function(selectedByIds){
            var $this = this
                , id = $this.data('id');
            if($this.is(':checked'))
                selectedByIds.push(id);
            else
                selectedByIds.remove(id);
        },

        // 参数验证
        _verifyParam: function(param){
            if(typeof param == undefined || typeof param == 'undefined'){
                return false;
            }
            if(param instanceof Array && param.length == 0){
                return false;
            }
        },

        // 表格排序
        _sortGrid: function(column, sortType){
            var _this = this
                , $tableBody = $(_this._tableBodySelector)
                , $bodyTrDOM = $tableBody.find('tr');

            _this._verifyParam(_this.gridDataInfo);
            $bodyTrDOM.sort(_this._privateFunc._sortList(column, sortType || 'asc'));
            _this._resizeIndex($bodyTrDOM);
            $tableBody.find('table').html($bodyTrDOM);
        },

        // 重置列索引
        _resizeIndex: function(bodyTrDOM){
            var $bodyTrDOM = bodyTrDOM || $(this._tableBodySelector).find('tr');

            return $bodyTrDOM.each(function(k, v){
                $(v).find('td[data-name=rn]').text(k + 1);
            });
        },

        // 根据ID获取索引（暂支持单个ID）
        _getGridRowIndexById: function(IdsArray){
            var indexs = '';

            $.each(this.gridDataInfo, function(index, el) {
                if(el.id == IdsArray){
                    indexs = index;
                    return false;
                }
            });
            return indexs;
        },

        // 新增, 丢失事件操作，且刷新表体，不建议在循环中使用（后期可考虑克隆解决）
        addNewRow: function(rowData, posId){
            var _this = this
                , indexOfId;

            indexOfId = _this._getGridRowIndexById(posId);
            _this.gridDataInfo.splice(indexOfId, 0, rowData);
            _this.reloadGrid();
        },

        // 重载grid, 必要方法, 会刷新且丢弃原有事件（但不建议插件内部使用）
        reloadGrid: function(gridDataInfoByOutside){
            var _this = this;

            _this._verifyParam(_this.gridDataInfo);
            if(gridDataInfoByOutside)
                _this.gridDataInfo = gridDataInfoByOutside;
            _this._bulidGridBody($(_this.ElmBox), _this.colModel, _this.thName, _this.bstyle);
            $('#' + _this.allCheckBtn).prop('checked', false);
            _this.setFootRowValue('none');
            _this.selectedByIds = [];
        },

        // 统计数值
        _totalColNum: function(isTotalChecked){
            var _this = this
                , totalMap = {}
                , selectedInfo
                , columnNames;

            if(_this.options.footerShowColName){
                columnNames = _this.options.footerShowColName
            }else{
                columnNames = _this.options.colModel.map(function(elem) {
                    if(!elem.formatOption){
                        return elem.name;
                    }else if(typeof elem.formatOption == 'function'){
                        return elem.name;
                    }
                });
            }

            if(isTotalChecked){
                selectedInfo = _this.getGridInfoByIds(_this.selectedByIds);
            }else{
                selectedInfo = _this.gridDataInfo;
            }
            if(selectedInfo.length != 0){
                for(var x = 0; x < columnNames.length; x++){
                    var totalCache = 0;

                    if(columnNames[x] != undefined){
                        var isNumber = false;

                        $.each(selectedInfo, function(idx, ele) {
                            if(ele[columnNames[x]] != undefined && typeof ele[columnNames[x]] == 'number'){
                                totalCache += ele[columnNames[x]];
                                isNumber = true;
                            }
                        });
                        totalMap[columnNames[x]] = isNumber ? totalCache : null;
                    }
                }
            }else{
                _this.setFootRowValue('none');
            }
            _this.setFootRowValue(totalMap);
            _this.totalMap = totalMap;
        },

        // 设置表尾统计值
        setFootRowValue: function(totalMap){
            var _this = this
                , $tds = $(_this._tableFootSelector).find('td');

            _this._verifyParam(totalMap);
            if(totalMap === 'none')
                $tds.text('');
            else{
                $tds.each(function(index, el) {
                    var $this = $(this)
                        , columnName = $this.attr('data-column')
                        , totalToCol = totalMap[columnName]
                        , totalToFix;

                    if(typeof totalToCol == 'number'){
                        totalToFix = _this._formatColumnVal(columnName, totalToCol);
                        $this.text(totalToFix);
                    }
                });
            }
        },

        // 设置选中行
        setSelectionRow: function(Ids, isChecked){
            var _this = this
                , $_tableBodySelector = $(_this._tableBodySelector);

            if(typeof Ids === 'string')
                Ids = Ids.split(' ');
            for(var x = 0; x < Ids.length; x++){
                $_tableBodySelector.find('input[data-id='+ Ids[x] +']').prop('checked', isChecked);
                isChecked ? _this.selectedByIds.push(Ids[x]) : _this.selectedByIds.remove(Ids[x]);
            }
            _this._totalColNum();
        },

        // 全选按钮事件
        _allCheckedEvent: function(){
            var _this = this
                , inputList = $(_this._tableBodySelector).find('td input[type=checkbox]')
                , getTotlColNum;

            $('#' + _this.allCheckBtn).on('click.quickGrid', function(){
                var isChecked = $(this).is(':checked');

                inputList.prop('checked', isChecked);

                if(isChecked){
                    if(!getTotlColNum){
                        _this._totalColNum();
                        getTotlColNum = _this.getTotalColNum();
                    }else{
                        _this.setFootRowValue(getTotlColNum);
                    }
                }else{
                    _this.setFootRowValue('none');
                }
            })
        },

        // 清空Grid
        cleanGridRow: function(){
            var _this = this;

            $(_this._tableBodySelector).find('#' + this.ElmId).html('');
            _this.gridDataInfo = [];
            _this.selectedByIds = [];
            $('#' + _this.allCheckBtn).attr('checked', false);
        },

        // 根据ID删除指定行数据，会刷新并修改全局缓存数据（后期可用删除节点优化性能）
        deleteGridRowDataByIds: function(Ids){
            var _this = this
                , dataInfos = _this.gridDataInfo;

            if(typeof Ids === 'string')
                Ids = Array.prototype.slice.call(arguments);
            for(var x in Ids){
                if(Ids.hasOwnProperty(x)){
                    for(var y = 0; y < dataInfos.length; y++){
                        if(Ids[x] == dataInfos[y].id){
                            dataInfos.splice(x, 1);
                            break;
                        }
                    }
                }
            }
            _this.gridDataInfo = dataInfos;
            _this.reloadGrid();
        },

        // 设置单元格具体值
        setGridCell: function(rowId, columnName, val){
            var _this = this
                , text = _this._formatColumnVal(columnName, val);

            $(_this._tableBodySelector).find('tr[id='+ rowId +']').find('td[data-name='+ columnName +']').text(text);
            $.each(_this.gridDataInfo, function(k, v){
                if(v.id == rowId){
                    v[columnName] = val;
                    return false;
                }
            });
            _this._totalColNum(true);
        },

        // 设置格式化映射
        _setFormatColumnMap: function(){
            var _this = this
                , colModels = _this.options.colModel
                , formatColumnConfigMap = {};

            // 存储格式化配置映射
            for(var x = 0; x < colModels.length; x++){
                formatColumnConfigMap[colModels[x].name] = (colModels[x].formatOption || null);
            }
            _this.formatColumnConfigMap = formatColumnConfigMap;
        },

        // 格式化列数据
        _formatColumnVal: function(column, val){
            var _this = this
                , formatVal
                , format = _this.formatColumnConfigMap[column];

            if(format && typeof format == 'object' && format.typeEnum){
                formatVal = format.typeEnum[val] || val;
            }else if(format && typeof format == 'function'){
                formatVal = format.call(_this, val) || null;
            }else{
                formatVal = val;
            }
            return formatVal;
        },

        // 自适应宽度控制
        resizeWidth: function(){
            var _this = this;

            $(window).resize(function() {
                var diffWidth = $(_this.ElmParent).outerWidth();

                $(_this.ElmBox).css('width', diffWidth);
                $(_this._tableHeadSelector + ', ' + _this._tableBodySelector + ', ' + _this._tableFootSelector).css('width', diffWidth);
                $(_this.ElmBox + ' .qgbox-htable' + ', ' + _this.ElmBox + ' .qgbox-ftable').css('width', diffWidth - 16);
                $(_this.ElmBox + ' .qgbox-btable').css('width', diffWidth - 17);
            });
        }
    };

    // 私有底层处理方法
    $.quickGrid._privateFunc = {
        // 数组删除
        _deleteById: function(){
            Array.prototype.remove = function(val) {
                var index = this.indexOf(val);
                if (index > -1) {
                    this.splice(index, 1);
                }
            };
        },

        // 排序
        _sortList: function(desc, name, minor){
            var sortType = desc.toLowerCase();

            return function(o, p){
                var a, b;

                if (o && p && typeof o === 'object' && typeof p === 'object') {
                    a = $(o).find('td[data-name='+name+']').data('unformatvalue') || o[name] || o;
                    b = $(p).find('td[data-name='+name+']').data('unformatvalue') || p[name] || p;

                    if (a === b) {
                        return typeof minor === 'function' ? minor(o, p): 0;
                    }

                    if (typeof a === typeof b) {
                        if (sortType == "asc") {
                            return a < b ? -1 : 1;
                        } else if(sortType == "desc") {
                            return a > b ? -1 : 1;
                        }
                    }

                    if (sortType == "desc") {
                        return typeof a < typeof b ? -1 : 1;
                    } else if(sortType == "asc") {
                        return typeof a > typeof b ? -1 : 1;
                    }
                }else{
                    throw ("error");
                }
            }
        }
    };

    // 默认配置参数
    $.quickGrid.defaults = {
        url: null,                  // 请求数据地址，
        ajaxOptions: {},            // ajax请求额外配置，可空
        dataType: "local",          // 数据获取方式，本地数据时候需要填写
        localData: null,            // 本地数据
        colModel: [],               // 列设置，支持：name、label、sortable、width、align、hidden属性, 以及formatOption，此属性支持键值对(typeEnum为必要关键字)和return方法函数
        autoWidth: true,            // 用于不出现滚动条自动设置列宽
        footerRow: true,            // 是否显示表尾，主要用于统计选中金额
        footerShowColName: null,    // 要显示金额的具体列设置，空值为显示全部
        firstRunNum: 0,             // 第一次加载Grid显示数据数目，默认显示全部
        onceRunNum: 0,              // 每次滚动加载显示行数目（待开发）
        gridHeight: 200,            // 表格滚动主体高度
        onSelectGridRow: $.noop()   // 选中后触发callback事件
    };
})(jQuery, window, document);