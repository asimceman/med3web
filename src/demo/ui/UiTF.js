/**
 * @fileOverview UiTF
 * @author Epam
 * @version 1.0.0
 */


// ********************************************************
// Imports
// ********************************************************

// special css for NoUiSlioder
import 'nouislider/distribute/nouislider.css';
import React from 'react';
import { connect } from 'react-redux';

import Nouislider from 'react-nouislider';
import StoreActionType from '../store/ActionTypes';
import UiHistogram from './UiHistogram';


// ********************************************************
// Const
// ********************************************************

// ********************************************************
// Class
// ********************************************************
/**
 * Class UiTF some text later...
 */
class UiTF extends React.Component {
  constructor(props) {
    super(props);
    //this.onUndo = this.onUndo.bind(this);
    this.m_updateEnable = true;
    this.onAO = this.onAO.bind(this);
    this.offAO = this.offAO.bind(this);
    this.onStartEr = this.onStartEr.bind(this);
    this.onStopEr = this.onStopEr.bind(this);
    this.onUndo = this.onUndo.bind(this);
  }
  onAO() {
    const store = this.props;
    const isoThreshold = store.sliderIsosurface;//this.refs.sliderIsosurface.slider.get();
    store.volumeRenderer.setAmbientTextureMode(isoThreshold);
  }
  offAO() {
    const store = this.props;
    store.volumeRenderer.offAmbientTextureMode();
  }
  onStartEr() {
    const store = this.props;
    store.volumeRenderer.setEraserStart(true);
  }
  onStopEr() {
    const store = this.props;
    store.volumeRenderer.setEraserStart(false);
  }
  onUndo() {
    const store = this.props;
    store.volumeRenderer.undoEraser();
  }
  onSave() {
    console.log(`onSave`);
  }
  onChangeSliderTF() {
    this.m_updateEnable = false;
    const aval = this.refs.sliderTF.slider.get();
    const store = this.props;
    store.dispatch({ type: StoreActionType.SET_SLIDER_3DR, slider3d_r: Number.parseFloat(aval[0]) });
    store.dispatch({ type: StoreActionType.SET_SLIDER_3DG, slider3d_g: Number.parseFloat(aval[1]) });
    store.dispatch({ type: StoreActionType.SET_SLIDER_3DB, slider3d_b: Number.parseFloat(aval[2]) });
  }
  shouldComponentUpdate(nextProps) {
    //return this.m_updateEnable;
    let flag = this.m_updateEnable;
    if (this.props.mode3d !== nextProps.mode3d) {
      flag = true;
    }
    return flag;
    //return true;
  }
  onChangeSliderOpacity() {
    this.m_updateEnable = false;
    const aval = this.refs.sliderOpacity.slider.get();
    const store = this.props;
    store.dispatch({ type: StoreActionType.SET_SLIDER_Opacity, sliderOpacity: Number.parseFloat(aval) });
  }
  onChangeSliderIsosurface() {
    this.m_updateEnable = false;
    const aval = this.refs.sliderIsosurface.slider.get();
    const store = this.props;
    store.dispatch({ type: StoreActionType.SET_SLIDER_Isosurface, sliderIsosurface: Number.parseFloat(aval) });
  }
  onChangeSliderErRadius() {
    this.m_updateEnable = false;
    const aval = this.refs.sliderErRadius.slider.get();
    const store = this.props;
    store.dispatch({ type: StoreActionType.SET_SLIDER_ErRadius, sliderErRadius: Number.parseFloat(aval) });
  }
  onChangeSliderErDepth() {
    this.m_updateEnable = false;
    const aval = this.refs.sliderErDepth.slider.get();
    const store = this.props;
    store.dispatch({ type: StoreActionType.SET_SLIDER_ErDepth, sliderErDepth: Number.parseFloat(aval) });
  }
  /**
   * Main component render func callback
   */
  render() {
    const store = this.props;

    // const modeViewIndex = store.modeView;
    const mode3d = store.mode3d;
    const slider3dr = store.slider3d_r;
    const slider3dg = store.slider3d_g;
    const slider3db = store.slider3d_b;
    const sliderOpacity = store.sliderOpacity;
    const sliderIsosurface = store.sliderIsosurface;
    const sliderErRadius = store.sliderErRadius;
    const sliderErDepth = store.sliderErDepth;
    const wArr = [slider3dr, slider3dg, slider3db];
    const wArrOpacity = [sliderOpacity];
    const wArrIsosurface = [sliderIsosurface];
    const wArrErRadius = [sliderErRadius];
    const wArrErDepth = [sliderErDepth];
    const vol = store.volume;


    const styleObj = {
      //borderColor: 'red white',
      //borderStyle: 'solid',
      margin: '30px 0px 0px'
    };
    const jsxVolumeTF =
      <ul className="list-group" >
        <li className="list-group-item">
          <UiHistogram volume={vol} />
        </li>
        <li className="list-group-item" style={styleObj}>
          <Nouislider onSlide={this.onChangeSliderTF.bind(this)} ref={'sliderTF'}
            range={{ min: 0.0, max: 1.0 }}
            start={wArr} connect={[false, true, false, true]} step={0.02} tooltips={true} />
        </li>
        <li className="list-group-item">
          <p> Opacity </p>
          <Nouislider onSlide={this.onChangeSliderOpacity.bind(this)} ref={'sliderOpacity'}
            range={{ min: 0.0, max: 1.0 }}
            start={wArrOpacity} step={0.02} tooltips={true} />
        </li>
      </ul>
    const jsxIsoTF =
      <ul className="list-group">
        <li className="list-group-item">
          <UiHistogram volume={vol} />
        </li>
        <li className="list-group-item">
          <p> Isosurface </p>
          <Nouislider onSlide={this.onChangeSliderIsosurface.bind(this)} ref={'sliderIsosurface'}
            range={{ min: 0.0, max: 1.0 }}
            start={wArrIsosurface} step={0.02} tooltips={true} />
        </li>
        <li className="list-group-item">
          Ambient Oclusion -> 
          <button type="button" className={'btn btn-outline-dark'} onClick={this.onAO} >
            On
          </button>
          <button type="button" className={'btn btn-outline-dark'} onClick={this.offAO} >
            Off
          </button>
          <button type="button" className={'btn btn-outline-dark'} onClick={this.onAO} >
            Resert
          </button>
        </li>
      </ul>
    const jsxEreaser =
      <div className="card">
        <div className="card-header">
          Press Start + Mouse Down [+ Mouse Move] for erease
        </div>
        <ul className="list-group list-group-flush">
          <li className="list-group-item">
            <p> Radius </p>
            <Nouislider onSlide={this.onChangeSliderErRadius.bind(this)} ref={'sliderErRadius'}
              range={{ min: 1.0, max: 100.0 }}
              start={wArrErRadius} step={0.02} tooltips={true} />
          </li>
          <li className="list-group-item">
            <p> Depth </p>
            <Nouislider onSlide={this.onChangeSliderErDepth.bind(this)} ref={'sliderErDepth'}
              range={{ min: 1.0, max: 100.0 }}
              start={wArrErDepth} step={0.02} tooltips={true} />
          </li>
          <li className="list-group-item">
            <p> Isosurface </p>
            <Nouislider onSlide={this.onChangeSliderIsosurface.bind(this)} ref={'sliderIsosurface'}
              range={{ min: 0.0, max: 1.0 }}
              start={wArrIsosurface} step={0.02} tooltips={true} />
          </li>
          <li className="list-group-item">
            <button type="button" className={'btn btn-outline-dark'} onClick={this.onStartEr} >
              Start
            </button>
            <button type="button" className={'btn btn-outline-dark'} onClick={this.onStopEr} >
              Stop
            </button>
            <button type="button" className={'btn btn-outline-dark'} onClick={this.onUndo} >
              Undo
            </button>
            <button type="button" className={'btn btn-outline-dark'} onClick={this.onSave} >
              Save
            </button>
          </li>
        </ul>
      </div>

    const jsxRayfastTF =
      <ul className="list-group">
        <li className="list-group-item">
          <p> </p>
        </li>
      </ul>

    console.log(`UiTF . mode = ${mode3d}`);
    const jsxArray = [jsxIsoTF, jsxVolumeTF, jsxRayfastTF, jsxEreaser];
    const jsxRet = jsxArray[mode3d];
    return jsxRet;
  }
}

export default connect(store => store)(UiTF);
