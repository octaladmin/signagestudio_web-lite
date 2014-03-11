/**
 This base class for all Blocks / players which reside on the timeline_channel or inside scenes.
 The base class implements basic timeline and scene interfaces including the management the properties UI.
 @class Block
 @constructor
 @param {string} i_placement indicates if the block is set to exist inside a timeline or inside a scene
 @param {string} i_block_id block / player id, only required if block inserted onto channel_timeline
 @return none
 **/
define(['jquery', 'backbone'], function ($) {

    /**
     block.PLACEMENT_SCENE indicates the insertion is inside a Scene
     @property Block.PLACEMENT_SCENE
     @static
     @final
     @type String
     */
    BB.CONSTS.PLACEMENT_SCENE = 'PLACEMENT_SCENE';

    /**
     block.PLACEMENT_CHANNEL indicates the insertion is on the timeline_channel
     @property Block.PLACEMENT_CHANNEL
     @static
     @final
     @type String
     */
    BB.CONSTS.PLACEMENT_CHANNEL = 'PLACEMENT_CHANNEL';

    /**
     event fires when block is selected
     @event Block.BLOCK_SELECTED
     @param {this} caller
     @param {String} selected block_id
     **/
    BB.EVENTS.BLOCK_SELECTED = 'BLOCK_SELECTED';

    /**
     event fires when block length is changing (requesting a change), normally by a knob property widget
     @event Block.BLOCK_LENGTH_CHANGING
     @param {object} this
     @param {object} caller the firing knob element
     @param {number} value the knob's position value (hours / minutes / seconds)
     **/
    BB.EVENTS.BLOCK_LENGTH_CHANGING = 'BLOCK_LENGTH_CHANGING';

    var Block = BB.Controller.extend({

        /**
         Constructor
         @method initialize
         **/
        initialize: function (options) {
            var self = this;
            this.m_placement = options.i_placement;
            this.m_block_id = options.i_block_id;
            self.m_blockType = options.blockType;
            this.m_selected = false;
            self.m_blockName = BB.JalapenoHelper.getBlockBoilerplate(self.m_blockType).name;
            self.m_blockDescription = BB.JalapenoHelper.getBlockBoilerplate(self.m_blockType).description;
            self.m_blockIcon = BB.JalapenoHelper.getBlockBoilerplate(self.m_blockType).icon;
            self.m_resourceID = undefined;
            this.m_property = BB.comBroker.getService(BB.SERVICES['PROPERTIES_VIEW']);


            $('#MySpinner').spinner()

            // common channel
            self._alphaListenChange();
            self._gradientListenChange();


            // block specific: channel / scene
            switch (this.m_placement) {
                case BB.CONSTS.PLACEMENT_CHANNEL:
                {
                    self.m_blockPlacement = BB.CONSTS.PLACEMENT_CHANNEL;
                    self._onTimelineChannelBlockSelected();
                    self._onTimelineChannelBlockLengthChanged();
                    break;
                }

                case BB.CONSTS.PLACEMENT_SCENE:
                {
                    self.m_blockPlacement = BB.CONSTS.PLACEMENT_SCENE;
                    break;
                }
            }
        },

        /**
         Listen to changes in Alpha UI properties selection and update msdb
         @method _alphaListenChange
         **/
        _alphaListenChange: function () {
            var self = this;
            self.m_blockAlphaHandler = $(Elements.BLOCK_ALPHA_SLIDER).on('change', function (e) {
                if (!self.m_selected)
                    return;
                var alpha = parseFloat($(Elements.BLOCK_ALPHA_SLIDER).val()) / 100;
                var domPlayerData = self._getBlockPlayerData();
                var xSnippet = $(domPlayerData).find('Appearance');
                $(xSnippet).attr('alpha', alpha);
                self._updatePlayerData(domPlayerData);
            });
        },

        /**
         On changes in msdb model updated UI common alpha properties
         @method _alphaPopulate
         @param {Number} i_playerData
         @return {Number} Unique clientId.
         **/
        _alphaPopulate: function () {
            var self = this;
            var domPlayerData = self._getBlockPlayerData();
            var xSnippet = $(domPlayerData).find('Appearance');
            var alpha = $(xSnippet).attr('alpha');
            alpha = parseFloat(alpha) * 100;
            $(Elements.BLOCK_ALPHA_SLIDER).val(alpha);
        },

        /**
         Update a block's player_data with new gradient background
         @method _gradientListenChange
         **/
        _gradientListenChange: function(){
            var self = this;

            BB.comBroker.listen(BB.EVENTS.GRADIENT_COLOR_CHANGED,function(e){
                if (!self.m_selected)
                    return;

                var points = e.edata.points;
                var styles = e.edata.styles;
                if (points.length == 0)
                    return;

                var domPlayerData = self._getBlockPlayerData();
                var gradientPoints = $(domPlayerData).find('GradientPoints');
                $(gradientPoints).empty();

                for (var i = 0; i < points.length; ++i) {
                    var pointMidpoint = (parseInt(points[i].position * 250));
                    var color = BB.lib.colorToDecimal(points[i].color)
                    var xPoint = '<Point color="' + color + '" opacity="1" midpoint="' + pointMidpoint + '" />'
                    // log(xPoint);
                    $(gradientPoints).append(xPoint);
                }
                self._updatePlayerData(domPlayerData);
            })
        },

        /**
         On changes in msdb model updated UI common gradient background properties
         @method _gradientPopulate
         @param {Number} i_playerData
         @return {Number} Unique clientId.
         **/
        _gradientPopulate: function () {
            var self = this;

            var gradient = $(Elements.BG_COLOR_GRADIENT_SELECTOR).data("gradientPicker-sel");
            // gradient.changeFillDirection("top"); /* change diretion future support */
            gradient.removeAllPoints();
            var domPlayerData = self._getBlockPlayerData();
            var xSnippet = $(domPlayerData).find('GradientPoints');
            var points = $(xSnippet).find('Point');

            $.each(points, function (i, point) {
                var pointColor = BB.lib.decimalToHex($(point).attr('color'));
                var pointMidpoint = (parseInt($(point).attr('midpoint')) / 250);
                gradient.addPoint(pointMidpoint, pointColor, true);
            });
        },

        /**
         Notify this object that it has been selected so it can populate it's own the properties box etc
         The function triggers from the BLOCK_SELECTED event.
         @method _onTimelineChannelBlockSelected
         @return none
         **/
        _onTimelineChannelBlockSelected: function () {
            var self = this;

            BB.comBroker.listenWithNamespace(BB.EVENTS.BLOCK_SELECTED, self, function (e) {
                var blockID = e.edata;
                if (self.m_block_id != blockID) {
                    self.m_selected = false;
                    return;
                }

                self.m_selected = true;
                self.m_property.viewPanel(Elements.BLOCK_PROPERTIES);
                self._updateTitle();
                self._updateTitleTab();
                self._alphaPopulate();
                self._gradientPopulate();

                // log('block selected ' + self.m_block_id);

                switch (self.m_placement) {
                    case BB.CONSTS.PLACEMENT_CHANNEL:
                    {
                        $(Elements.CHANNEL_BLOCK_PROPS).show();
                        $(Elements.SCENE_BLOCK_PROPS).hide();
                        self._updateBlockLength();
                        break;
                    }
                    // Future support
                    case BB.CONSTS.PLACEMENT_SCENE:
                    {
                        $(Elements.CHANNEL_BLOCK_PROPS).hide();
                        $(Elements.SCENE_BLOCK_PROPS).show();
                        self._updateBlockDimensions();
                        break;
                    }
                }

                if (self._loadBlockSpecificProps)
                    self._loadBlockSpecificProps();
            });
        },

        /**
         Update the title of the block inside the assigned element.
         @method _updateTitle
         @return none
         **/
        _updateTitle: function () {
            var self = this;
            $(Elements.SELECTED_CHANNEL_RESOURCE_NAME).text(self.m_blockName);
        },

        /**
         Update the title of the selected tab properties element
         @method m_blockAcronym
         **/
        _updateTitleTab: function () {
            var self = this;
            self.m_blockAcronym = BB.JalapenoHelper.getBlockBoilerplate(self.m_blockType).acronym;
            $(Elements.BLOCK_SUBPROPERTIES_TITLE).text(self.m_blockAcronym);
        },

        /**
         Update the length properties of the block with respect to position on the timeline_channel
         @method _updateBlockLength
         @return none
         **/
        _updateBlockLength: function () {
            var self = this;
            var lengthData = jalapeno.getBlockTimelineChannelBlockLength(self.m_block_id);
            $(Elements.BLOCK_LENGTH_HOURS).val(lengthData.hours).trigger('change');
            $(Elements.BLOCK_LENGTH_MINUTES).val(lengthData.minutes).trigger('change');
            $(Elements.BLOCK_LENGTH_SECONDS).val(lengthData.seconds).trigger('change');
        },

        /**
         Update the position of the block when placed inside a scene
         @method _updateBlockDimensions
         **/
        _updateBlockDimensions: function () {
        },

        /**
         Take action when block length has changed which is triggered by the BLOCK_LENGTH_CHANGING event
         @method _onTimelineChannelBlockLengthChanged
         @return none
         **/
        _onTimelineChannelBlockLengthChanged: function () {
            var self = this;

            BB.comBroker.listenWithNamespace(BB.EVENTS.BLOCK_LENGTH_CHANGING, this, function (e) {

                if (self.m_selected) {
                    var hours = $(Elements.BLOCK_LENGTH_HOURS).val();
                    var minutes = $(Elements.BLOCK_LENGTH_MINUTES).val();
                    var seconds = $(Elements.BLOCK_LENGTH_SECONDS).val();

                    switch (e.caller) {
                        case 'blockLengthHours':
                        {
                            hours = e.edata;
                            break;
                        }
                        case 'blockLengthMinutes':
                        {
                            minutes = e.edata;
                            break;
                        }
                        case 'blockLengthSeconds':
                        {
                            seconds = e.edata;
                            break;
                        }
                    }
                    // log('upd: ' + self.m_block_id + ' ' + hours + ' ' + minutes + ' ' + seconds);
                    jalapeno.setBlockTimelineChannelBlockLength(self.m_block_id, hours, minutes, seconds);
                }
            });
        },

        /**
         Update the msdb for the block with new values inside its player_data
         @method _updatePlayerData
         @param {Object} i_xmlDoc
         **/
        _updatePlayerData: function (i_xmlDoc) {
            var self = this;
            var xmlString = (new XMLSerializer()).serializeToString(i_xmlDoc);
            switch (self.m_placement) {
                case BB.CONSTS.PLACEMENT_CHANNEL:
                {
                    jalapeno.setCampaignTimelineChannelPlayerRecord(self.m_block_id, 'player_data', xmlString);
                    break;
                }
                case BB.CONSTS.PLACEMENT_SCENE:
                {
                    break;
                }
            }
        },

        /**
         Get the XML player data of a block, depending where its placed
         @method _getBlockPlayerData
         @return {Object} player data of block (aka player) parsed as DOM
         **/
        _getBlockPlayerData: function () {
            var self = this;
            var recBlock = undefined;

            switch (self.m_placement) {

                case BB.CONSTS.PLACEMENT_CHANNEL:
                {
                    recBlock = jalapeno.getCampaignTimelineChannelPlayerRecord(self.m_block_id);
                    break;
                }

                case BB.CONSTS.PLACEMENT_SCENE:
                {
                    // recBlock = jalapeno.get...(self.m_block_id);
                    break;
                }
            }
            return $.parseXML(recBlock['player_data']);
        },

        /**
         Delete block is a private method that is always called regardless if instance has
         been inherited or not. Used for releasing memory for garbage collector.
         @method _deleteBlock
         @return none
         **/
        _deleteBlock: function () {
            var self = this;
            jalapeno.removeBlockFromTimelineChannel(self.m_block_id);
            BB.comBroker.stopListenWithNamespace(BB.EVENTS.BLOCK_SELECTED, self);
            BB.comBroker.stopListenWithNamespace(BB.EVENTS.BLOCK_LENGTH_CHANGING, self);
            $(Elements.BLOCK_ALPHA_SLIDER).off('change', self.m_blockAlphaHandler);
            $.each(self, function (k) {
                self[k] = undefined;
            });
        },

        /**
         Get block data as a json formatted object literal and return to caller
         @method getBlockData
         @return {object} data
         The entire block data members which can be made public
         **/
        getBlockData: function () {
            var self = this;
            var data = {
                blockID: self.m_block_id,
                blockType: self.m_blockType,
                blockName: self.m_blockName,
                blockDescription: self.m_blockDescription,
                blockIcon: self.m_blockIcon
            }
            return data;
        },

        /**
         Delete block is a public method used as fall back method, if not overridden by inherited instance.
         It is also a semi abstract method, all implementations should go into _deleteBlock();
         @method deleteBlock
         @return none
         **/
        deleteBlock: function () {
            /* semi-abstract, overridden, do not modify */
            var self = this;
            self._deleteBlock();
        }
    });

    return Block;
});