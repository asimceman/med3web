/*
 * Copyright 2021 EPAM Systems, Inc. (https://www.epam.com/)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { connect } from 'react-redux';
import zlib from 'zlib';
import createReadStream from 'filereader-stream';

import VolumeSet from '../engine/VolumeSet';
import Volume from '../engine/Volume';
import Texture3D from '../engine/Texture3D';

import StoreActionType from '../store/ActionTypes';
import ModeView from '../store/ModeView';
import Modes3d from '../store/Modes3d';

import LoadResult from '../engine/LoadResult';
import FileTools from '../engine/loaders/FileTools';
import LoaderDicom from '../engine/loaders/LoaderDicom';
import LoaderHdr from '../engine/loaders/LoaderHdr';

import { ReactComponent as OpenLocalFolderIcon } from "./icons/folder.svg";
import { ReactComponent as OpenLinkIcon } from "./icons/link.svg";
import { ReactComponent as OpenDemoIcon } from "./icons/demo.svg";
import { ReactComponent as OpenLocalFileIcon } from "./icons/file.svg";
import { ReactComponent as DownloadIcon } from "./icons/download.svg";
import { ReactComponent as GetFileIcon } from "./icons/getfile.svg";


import LoaderDcmDaikon from "../engine/loaders/LoaderDcmDaikon";
import LoaderDcmUrlDaikon from "../engine/loaders/LoadDcmUrlDiakon";

import './UiOpenMenu.css';

/** deep artificially fix volume texture size to 4 * N */
const NEED_TEXTURE_SIZE_4X = true;

class UiOpenMenu extends React.Component {
  constructor(props) {
    super(props);
		
    this.m_fileNameOnLoad = '';
    this.m_fileName = '';
    this.m_fileIndex = 0;
    this.m_fileReader = null;
    this.state = {
      strUrl: '',
      showModalUrl: false,
      showModalDemo: false,
      showModalGoogle: false,
      showModalWindowCW: false,
      onLoadCounter: 1,
    };
    this.m_volumeSet = null;
    this.m_volumeRoi = null;
    this.m_updateEnable = true;
    this.roiMode = false;
  }
  finalizeSuccessLoadedVolume(volSet, fileNameIn) {
    const store = this.props;
		
    console.assert(volSet instanceof VolumeSet, "finalizeSuccessLoadedVolume: should be VolumeSet");
    console.assert(volSet.getNumVolumes() >= 1, "finalizeSuccessLoadedVolume: should be more or 1 volume");
    const indexVol = 0;
		
    const vol = volSet.getVolume(indexVol);
    console.assert(vol !== null, "finalizeSuccessLoadedVolume: should be non zero volume");
		
    if (vol.m_dataArray !== null) {
      console.log(`success loaded volume from ${fileNameIn}`);
      if (NEED_TEXTURE_SIZE_4X) {
        vol.makeDimensions4x();
      }
      // invoke notification
			
      // send update (repaint) if was loaded prev model
      if (store.isLoaded) {
        store.dispatch({ type: StoreActionType.SET_IS_LOADED, isLoaded: false });
      }
			
      store.dispatch({ type: StoreActionType.SET_VOLUME_SET, volumeSet: volSet });
      store.dispatch({ type: StoreActionType.SET_VOLUME_INDEX, volumeIndex: 0 });
      store.dispatch({ type: StoreActionType.SET_IS_LOADED, isLoaded: true });
      store.dispatch({ type: StoreActionType.SET_FILENAME, fileName: fileNameIn });
      store.dispatch({ type: StoreActionType.SET_ERR_ARRAY, arrErrors: [] });
      const tex3d = new Texture3D();
      tex3d.createFromRawVolume(vol);
      store.dispatch({ type: StoreActionType.SET_TEXTURE3D, texture3d: tex3d });
      store.dispatch({ type: StoreActionType.SET_MODE_VIEW, modeView: ModeView.VIEW_2D });
      store.dispatch({ type: StoreActionType.SET_MODE_3D, mode3d: Modes3d.RAYCAST });
    }
  }
  setErrorString(strErr) {
    const store = this.props;
    const arrErrors = [];
    arrErrors.push(strErr);
    store.dispatch({ type: StoreActionType.SET_IS_LOADED, isLoaded: false });
    store.dispatch({ type: StoreActionType.SET_ERR_ARRAY, arrErrors: arrErrors });
    store.dispatch({ type: StoreActionType.SET_VOLUME_SET, volume: null });
  }
  finalizeFailedLoadedVolume(volSet, fileNameIn, arrErrors) {
    console.assert(arrErrors !== undefined);
    // invoke notification
    const store = this.props;
    store.dispatch({ type: StoreActionType.SET_IS_LOADED, isLoaded: false });
    store.dispatch({ type: StoreActionType.SET_VOLUME_SET, volume: null });
    store.dispatch({ type: StoreActionType.SET_ERR_ARRAY, arrErrors: arrErrors });
    store.dispatch({ type: StoreActionType.SET_FILENAME, fileName: fileNameIn });
		
    const uiapp = store.uiApp;
    uiapp.doHideProgressBar();
  }
  callbackReadProgress(ratio01) {
    // console.log(`callbackReadProgress = ${ratio01}`);
    const ratioPrc = Math.floor(ratio01 * 100);
    const store = this.props;
    const uiapp = store.uiApp;
    if (uiapp !== null) {
      if (ratioPrc === 0) {
        uiapp.doShowProgressBar('Loading...');
      }
      if (ratioPrc >= 99) {
        // console.log(`callbackReadProgress. hide on = ${ratio01}`);
        uiapp.doHideProgressBar();
      } else {
        uiapp.doSetProgressBarRatio(ratioPrc);
      }
    }
  } // callback progress
  callbackReadComplete(errCode) {
    if (errCode === undefined) {
      console.log('callbackReadComplete. should be errCode');
    } else {
      if (errCode !== LoadResult.SUCCESS) {
        const strErr = LoadResult.getResultString(errCode);
        this.setErrorString(strErr);
      }
    }
    const store = this.props;
    const uiapp = store.uiApp;
    uiapp.doHideProgressBar();
		
    if (errCode === LoadResult.SUCCESS) {
      this.finalizeSuccessLoadedVolume(this.m_volumeSet, this.m_fileName);
    } else {
      const arrErr = [];
      const strErr = LoadResult.getResultString(errCode);
      arrErr.push(strErr);
      this.finalizeFailedLoadedVolume(this.m_volumeSet, this.m_fileName, arrErr);
    }
  }
  callbackReadSingleDicomComplete(errCode) {
    if (errCode === LoadResult.SUCCESS) {
      const store = this.props;
      store.dispatch({ type: StoreActionType.SET_VOLUME_SET, volumeSet: this.m_volumeSet });
      store.dispatch({ type: StoreActionType.SET_VOLUME_INDEX, volumeIndex: 0 });
      // save dicom loader to store
      store.dispatch({ type: StoreActionType.SET_LOADER_DICOM, loaderDicom: this.m_loader });
			
      // setup modal: window min, max
      this.childModalWindowCenterWidth.initWindowRange();
			
      // show modal: select window center, width
      this.setState({ showModalWindowCW: true });
      return; // do nothing immediately after: wait for dialog
    }
    this.callbackReadComplete(errCode);
  }
  callbackReadMultipleComplete(errCode) {
    if (errCode !== LoadResult.SUCCESS) {
      const strErr = LoadResult.getResultString(errCode);
      this.setErrorString(strErr);
    }
  }
  onFileReadSingleUncompressedFile(strContent, callbackProgress, callbackComplete, callbackCompleteSingleDicom) {
    if (this.m_fileName.endsWith('.ktx') || this.m_fileName.endsWith('.KTX')) {
      // if read ktx
      this.m_volumeSet.readFromKtx(strContent, callbackProgress, callbackComplete);
    } else if (this.m_fileName.endsWith('.nii') || this.m_fileName.endsWith('.NII')) {
      this.m_volumeSet.readFromNifti(strContent, callbackProgress, callbackComplete);
    } else if (this.m_fileName.endsWith('.dcm') || this.m_fileName.endsWith('.DCM')) {
      this.m_loader = new LoaderDicom();
      this.m_loader.m_zDim = 1;
      this.m_loader.m_numFiles = 1;
      this.m_volumeSet.readFromDicom(this.m_loader, strContent, callbackProgress, callbackCompleteSingleDicom);
    } else if (this.m_fileName.endsWith('.hdr') || this.m_fileName.endsWith('.HDR')) {
      // readOk = vol.readFromHdrHeader(strContent, callbackProgress, callbackComplete);
      console.log(`cant read single hdr file: ${this.m_fileName}`);
      // readStatus = LoadResult.BAD_HEADER;
    } else if (this.m_fileName.endsWith('.img') || this.m_fileName.endsWith('.IMG')) {
      // readOk = vol.readFromHdrImage(strContent, callbackProgress, callbackComplete);
      console.log(`cant read single img file: ${this.m_fileName}`);
      // readStatus = LoadResult.BAD_HEADER;
    } else {
      console.log(`onFileContentReadSingleFile: unknown file type: ${this.m_fileName}`);
    }
  }
  onFileContentReadSingleFile() {
    let strContent = this.m_fileReader.result;
    this.onFileReadSingleBuffer(strContent);
  }
  readSliceDicomViaDaikon(fileIndex, fileName, ratioLoad, strContent) {
    const loaderDaikon = new LoaderDcmDaikon();
    return loaderDaikon.readSlice(this.m_loader, fileIndex, fileName, strContent);
  }
  onFileReadSingleBuffer(strContent) {
    // daikon read
    // strContent is ArrayBuffer
    if ((this.m_fileName.endsWith('.dcm') || this.m_fileName.endsWith('.DCM'))) {
      const loaderDcm = new LoaderDcmDaikon();
      const store = this.props;
      const fileIndex = this.m_fileIndex;
      const fileName = this.m_fileName;
      this.m_loader = new LoaderDicom(1);
      const ret = loaderDcm.readSingleSlice(store, this.m_loader, fileIndex, fileName, strContent);
      this.callbackReadSingleDicomComplete(ret);
      return ret;
    }
		
    console.log('UiOpenMenu. onFileReadSingleBuffer ...');
    // console.log(`file content = ${strContent.substring(0, 64)}`);
    // console.log(`onFileContentRead. type = ${typeof strContent}`);
    this.m_volumeSet = new VolumeSet();
    // add empty [0]-th volume in set to read single file
    this.m_volumeSet.addVolume(new Volume())
    const callbackProgress = this.callbackReadProgress;
    const callbackComplete = this.callbackReadComplete;
    const callbackCompleteSingleDicom = this.callbackReadSingleDicomComplete;
		
		
    if (this.m_fileName.endsWith('.ktx') || this.m_fileName.endsWith('.KTX')) {
      // if read ktx
      this.m_volumeSet.readFromKtx(strContent, callbackProgress, callbackComplete);
    } else if (this.m_fileName.endsWith('.nii') || this.m_fileName.endsWith('.NII')) {
      this.m_volumeSet.readFromNifti(strContent, callbackProgress, callbackComplete);
    } else if (this.m_fileName.endsWith('.dcm') || this.m_fileName.endsWith('.DCM')) {
      this.m_loader = new LoaderDicom();
      this.m_loader.m_zDim = 1;
      this.m_loader.m_numFiles = 1;
      this.m_volumeSet.readFromDicom(this.m_loader, strContent, callbackProgress, callbackCompleteSingleDicom);
      // save dicomInfo to store
      const dicomInfo = this.m_loader.m_dicomInfo;
      const sliceInfo = dicomInfo.m_sliceInfo[0];
      sliceInfo.m_fileName = this.m_fileName;
      sliceInfo.m_sliceName = 'Slice 0';
      const store = this.props;
      store.dispatch({ type: StoreActionType.SET_DICOM_INFO, dicomInfo: dicomInfo });
    } else if (this.m_fileName.endsWith('.hdr') || this.m_fileName.endsWith('.HDR')) {
      // readOk = vol.readFromHdrHeader(strContent, callbackProgress, callbackComplete);
      console.log(`cant read single hdr file: ${this.m_fileName}`);
      // readStatus = LoadResult.BAD_HEADER;
    } else if (this.m_fileName.endsWith('.img') || this.m_fileName.endsWith('.IMG')) {
      // readOk = vol.readFromHdrImage(strContent, callbackProgress, callbackComplete);
      console.log(`cant read single img file: ${this.m_fileName}`);
      // readStatus = LoadResult.BAD_HEADER;
    } else {
      console.log(`onFileContentReadSingleFile: unknown file type: ${this.m_fileName}`);
    }
		
  }
  onFileContentReadMultipleHdr() {
    const VALID_NUM_FILES_2 = 2;
    const VALID_NUM_FILES_4 = 4;
    if ((this.m_numFiles !== VALID_NUM_FILES_2) && (this.m_numFiles !== VALID_NUM_FILES_4)) {
      console.log(`onFileContentReadMultipleHdr: can read ${VALID_NUM_FILES_2} or ${VALID_NUM_FILES_4} files for multiple hdr loader`);
      return;
    }
		
    const isHdr = this.m_fileName.endsWith('hdr') || this.m_fileName.endsWith('HDR');
    console.log(`onFileContentReadMultipleHdr: read file ${this.m_fileName}. Ratio=${this.m_fileIndex} / ${this.m_numFiles}`);
    this.m_fileIndex++;
    const ratioLoad = this.m_fileIndex / this.m_numFiles;
    const strContent = this.m_fileReader.result;
    // const lenContent = strContent.length;
		
    if (this.m_fileIndex <= 1) {
      // add single volume to set
      if (this.m_volumeSet.getNumVolumes() === 0) {
        this.m_volumeSet.addVolume(new Volume());
      }
      this.callbackReadProgress(0.0);
    }
		
    if ((this.m_numFiles === VALID_NUM_FILES_4) && (this.m_volumeRoi === null)) {
      this.m_volumeRoi = new Volume();
    }
		
    const callbackProgress = null;
    const callbackComplete = null;
		
    const regExpFileName = /([\S]+)\.[\S]+/;
    const fnameArr = regExpFileName.exec(this.m_fileName);
    const numFN = fnameArr.length;
    let detectedMask = false;
    let detectedIntensity = false;
    if (numFN === 2) {
      const fname = fnameArr[1];
      if (fname.endsWith('_mask')) {
        detectedMask = true;
      }
      if (fname.endsWith('_intn')) {
        detectedIntensity = true;
      }
    }
    let volDst = this.m_volumeSet.getVolume(0);
    if (this.m_fileIndex > VALID_NUM_FILES_2) {
      volDst = this.m_volumeRoi;
    }
    if (detectedIntensity) {
      volDst = this.m_volumeSet.getVolume(0);
    }
    if (detectedMask) {
      volDst = this.m_volumeRoi;
      this.roiMode = true;
      // console.log('mask vol by name');
      if (this.m_numFiles !== VALID_NUM_FILES_4) {
        console.log('You need to load 4 files, if one of them has _mask in name');
        return;
      }
    }
		
    // read header or image from src files
    let readOk;
    if (isHdr) {
      readOk = this.m_loader.readFromBufferHeader(volDst, strContent, callbackProgress, callbackComplete);
    } else {
      readOk = this.m_loader.readFromBufferImage(volDst, strContent, callbackProgress, callbackComplete);
    }
		
    // create final volume from readed data
    volDst = this.m_volumeSet.getVolume(0);
    if (readOk && (this.m_fileIndex === this.m_numFiles)) {
      let ok = false;
      if (this.m_numFiles === VALID_NUM_FILES_2) {
        ok = this.m_loader.createVolumeFromHeaderAndImage(volDst);
      } else if (this.m_numFiles === VALID_NUM_FILES_4) {
        // intensity data 16 -> 8 bpp
        ok = this.m_loader.createVolumeFromHeaderAndImage(volDst);
        if (ok) {
          // mix 8 bpp intensity and roi pixels
          ok = this.m_loader.createRoiVolumeFromHeaderAndImage(volDst, this.m_volumeRoi);
        }
      }
      this.callbackReadProgress(1.0);
      if (!ok) {
        this.callbackReadComplete(LoadResult.FAIL);
      } else {
        this.callbackReadComplete(LoadResult.SUCCESS);
      }
    }
		
    // read again new file
    if (this.m_fileIndex < this.m_numFiles) {
      this.callbackReadProgress(ratioLoad);
      this.m_fileReader.onloadend = this.onFileContentReadMultipleHdr;
      const file = this.m_files[this.m_fileIndex];
      this.m_fileName = file.name;
      this.m_fileReader.readAsArrayBuffer(file);
    }
		
  } // on multuple hdr
  // on complete read multuple dicom
  callbackCompleteMultipleDicom(errCode) {
    if (errCode !== LoadResult.SUCCESS) {
      const strErr = LoadResult.getResultString(errCode);
      this.setErrorString(strErr);
    }
  }
  onFileContentReadMultipleDicom() {
    // console.log('UiOpenMenu. onFileContentReadMultipleDicom ...');
    const strContent = this.m_fileReader.result;
    this.m_fileIndex++;
    const ratioLoad = this.m_fileIndex / this.m_numFiles;
		
    if (this.m_fileIndex <= 1) {
      // add new volume to volume set on the first slice
      const vol = new Volume();
      this.m_volumeSet.addVolume(vol);
      // init progress on the first file loading
      this.callbackReadProgress(0.0);
    }
		
    let readStatus = this.readSliceDicomViaDaikon(this.m_fileIndex - 1, this.m_fileName, ratioLoad, strContent);
		
    if (readStatus !== LoadResult.SUCCESS) {
      console.log('onFileContentReadMultipleDicom. Error read individual file');
    }
    if ((readStatus === LoadResult.SUCCESS) && (this.m_fileIndex === this.m_numFiles)) {
      // setup global vars
      const store = this.props;
      store.dispatch({ type: StoreActionType.SET_VOLUME_INDEX, volumeIndex: 0 });
      store.dispatch({ type: StoreActionType.SET_VOLUME_SET, volumeSet: this.m_volumeSet });
			
      // save dicom loader to store
      store.dispatch({ type: StoreActionType.SET_LOADER_DICOM, loaderDicom: this.m_loader });
      // stop show loading progress bar
      this.callbackReadProgress(1.0);
      this.callbackReadComplete(LoadResult.SUCCESS);
			
      this.childModalWindowCenterWidth.initWindowRange();
			
      // show modal: select window center, width
      this.setState({ showModalWindowCW: true });
      return; // do nothing immediately after: wait for dialog
      /*

			const numSeries = this.m_loader.m_slicesVolume.m_series.length;
			console.log(`num series = ${numSeries}`);
			const series = this.m_loader.m_slicesVolume.getSeries();
			// save loaded series description to store
			if (numSeries === 1) {
				const indexSerie = 0;
				const hash = series[indexSerie].m_hash;
				this.m_loader.createVolumeFromSlices(this.m_volumeSet, indexSerie, hash);
				this.finalizeSuccessLoadedVolume(this.m_volumeSet, this.m_fileName);
				console.log(`onFileContentReadMultipleDicom read all ${this.m_numFiles} files`);
			} else {
				// now we have loaded more then 1 series from dicon files set
				for (let i = 0; i < numSeries; i++) {
					const hashCode = series[i].m_hash;
					this.m_loader.createVolumeFromSlices(this.m_volumeSet, i, hashCode);
				}
				this.finalizeSuccessLoadedVolume(this.m_volumeSet, this.m_fileName);
				console.log(`onFileContentReadMultipleDicom create ${numSeries} volumes for ${this.m_numFiles} files`);

				// setup dicom series (volumes info) for global store: select volume later
				const store = this.props;
				store.dispatch({ type: StoreActionType.SET_DICOM_SERIES, dicomSeries: series });
			}
			
			this.callbackReadProgress(1.0);
			this.callbackReadComplete(LoadResult.SUCCESS);
			*/
    } // end if successfully read all files (multiple dicom read)
    // read again new file
    if (readStatus === LoadResult.SUCCESS) {
      if (this.m_fileIndex < this.m_numFiles) {
        // print console loading progress
        const NUM_PARTS_REPORT = 16;
        const STEP_PROGRESS = Math.floor(this.m_numFiles / NUM_PARTS_REPORT);
        if ((this.m_fileIndex % STEP_PROGRESS) === 0) {
          // console.log(`onFileContentReadMultipleDicom. Loading completed = ${ratioLoad}`);
          this.callbackReadProgress(ratioLoad);
        }
				
        this.m_fileReader.onloadend = this.onFileContentReadMultipleDicom;
        const file = this.m_files[this.m_fileIndex];
        this.m_fileName = file.name;
        this.m_fileReader.readAsArrayBuffer(file);
      } // if still need files
    } else {
      const arrErr = [];
      const strErr = this.props.arrErrors[0];
      arrErr.push(strErr);
      this.finalizeFailedLoadedVolume(this.m_volumeSet, this.m_fileName, arrErr);
    } // if result is not success
  }
  handleFileSelected(evt) {
    if (evt.target.files !== undefined) {
      let numFiles = evt.target.files.length;
      console.log(`UiOpenMenu. Trying to open ${numFiles} files`);
      if (numFiles <= 0) {
        return;
      }
      console.log(`UiOpenMenu. handleFileSelected. file[0] = ${evt.target.files[0].name}`);
      this.m_volumeSet = new VolumeSet();
      if (numFiles === 1) {
        const file = evt.target.files[0];
        this.m_fileName = file.name;
				
        //  read gzip
        if (this.m_fileName.endsWith('.gz')) {
          // here will be result raw buffer
          this.m_unzippedBuffer = null;
					
          // remove last 3 chars form file name string
          this.m_fileName = this.m_fileName.slice(0, -3);
					
          const store = this.props;
					
          const gunzip = zlib.createGunzip();
          createReadStream(file).pipe(gunzip);
          gunzip.on('data', (data) => {
            // progress
            const uiapp = store.uiApp;
            if (this.m_unzippedBuffer == null) {
              uiapp.doShowProgressBar('Read gzip...');
            } else {
              const readSize = this.m_unzippedBuffer.length;
              const allSize = file.size;
              const KOEF_DEFLATE = 0.28;
              const ratio100 = Math.floor(readSize * 100.0 * KOEF_DEFLATE / allSize);
              uiapp.doSetProgressBarRatio(ratio100);
            }
						
            // read the data chunk-by-chunk
            // data is Uint8Array
            const dataSize = data.length;
            if (this.m_unzippedBuffer == null) {
              // create buffer from first ungzipped data chunk
              this.m_unzippedBuffer = new Uint8Array(dataSize);
              this.m_unzippedBuffer.set(data, 0);
            } else {
              // append buffer from 2,3,... ungzipped data chunks
              const dataCollectedSize = this.m_unzippedBuffer.length;
              const arrNew = new Uint8Array(dataCollectedSize + dataSize);
              arrNew.set(this.m_unzippedBuffer, 0);
              arrNew.set(data, dataCollectedSize);
              this.m_unzippedBuffer = arrNew;
            }
          });
          gunzip.on('close', () => {
            console.log('gzip on close');
          });
					
          gunzip.on('end', () => {
            // close progress
            const uiapp = store.uiApp;
            uiapp.doHideProgressBar();
						
            // now all chunks are read. Need to check raw ungzipped buffer
            const sizeBuffer = this.m_unzippedBuffer.length;
            if (sizeBuffer < 128) {
              console.log('Too small ungzipped data: ' + sizeBuffer.toString() + ' bytes. canat read volume data');
              return;
            }
            // check correct nifti header after extract raw bytes from gzip
            const headTemplate = [0x00, 0x00, 0x01, 0x5c];
            let correctHead0 = true;
            for (let i = 0; i < 4; i++) {
              if (this.m_unzippedBuffer[i] !== headTemplate[i]) {
                correctHead0 = false;
              }
            }
            let correctHead1 = true;
            for (let i = 0; i < 4; i++) {
              if (this.m_unzippedBuffer[i] !== headTemplate[3 - i]) {
                correctHead1 = false;
              }
            }
            if (!correctHead0 && !correctHead1) {
              console.log('Wrong nifi header, cant read gzipped file');
              return;
            }
            console.log('ungzip done with ' + sizeBuffer.toString() + ' bytes. Correct nifti header detected');
            // process raw data buffer
            this.onFileReadSingleBuffer(this.m_unzippedBuffer);
          });
          return;
        } // if gzipped file
				
        this.m_fileReader = new FileReader();
        this.m_fileReader.onloadend = this.onFileContentReadSingleFile;
        this.m_fileReader.readAsArrayBuffer(file);
      } else {
        // not single file was open
        this.m_files = Array.from(evt.target.files); // FileList -> Array
        this.m_fileIndex = 0;
        this.m_numFiles = numFiles;
        this.m_fileReader = new FileReader();
        // if multiple files, create Dicom loader
        this.m_loader = null;
        if (evt.target.files[0].name.endsWith(".dcm")) {
					
          // remove non-dcm files
          let numFilesNew = 0;
          for (let i = numFiles - 1; i >= 0; i--) {
            if (this.m_files[i].name.endsWith(".dcm")) {
              numFilesNew++;
            } else {
              this.m_files.splice(i, 1);
            }
						
          }
          numFiles = numFilesNew;
          this.m_numFiles = numFilesNew;
					
          this.m_loader = new LoaderDicom(numFiles);
          const dicomInfo = this.m_loader.m_dicomInfo;
					
          // save dicomInfo to store
          const store = this.props;
          store.dispatch({ type: StoreActionType.SET_DICOM_INFO, dicomInfo: dicomInfo });
					
          // save dicom loader to store
          store.dispatch({ type: StoreActionType.SET_LOADER_DICOM, loaderDicom: this.m_loader });
					
          this.m_fileReader.onloadend = this.onFileContentReadMultipleDicom;
        } else if ((evt.target.files[0].name.endsWith(".hdr")) || (evt.target.files[0].name.endsWith(".img"))) {
          this.m_loader = new LoaderHdr(numFiles);
          this.m_fileReader.onloadend = this.onFileContentReadMultipleHdr;
        }
				
        //const vol = new Volume();
        //this.m_volume = vol;
        this.m_volumeRoi = null;
				
        const file = evt.target.files[0];
        this.m_fileName = file.name;
        this.m_fileReader.readAsArrayBuffer(file);
      } // if num files > 1
    } // if event is mnot empty
  }
  buildFileSelector() {
    const fileSelector = document.createElement('input');
    fileSelector.setAttribute('type', 'file');
    fileSelector.setAttribute('accept', '.ktx,.dcm,.nii,.hdr,.h,.img,.gz');
    fileSelector.setAttribute('multiple', '');
    fileSelector.onchange = this.handleFileSelected;
    return fileSelector;
  }
	onButtonLocalFile = (evt) => {
		  evt.preventDefault();
		  this.m_fileSelector.click();
	}
	onModalUrlShow() {
		  console.log(`onModalUrlShow`);
		  this.setState({ strUrl: '' });
		  this.setState({ showModalUrl: true });
	}
	onModalUrlHide() {
		  console.log(`onModalUrlHide`);
		  this.setState({ showModalUrl: false });
	}
	onChangeUrlString(evt) {
		  const str = evt.target.value;
		  this.setState({ strUrl: str });
		  // console.log(`onChangeUrlString. str = ${str}`)
	}
	callbackReadCompleteUrlKtxNii(codeResult) {
		  if (codeResult !== LoadResult.SUCCESS) {
		    console.log(`onCompleteFromUrlKtx. Bad result: ${codeResult}`);
				
		    const arrErrors = [];
		    const strErr = LoadResult.getResultString(codeResult);
		    arrErrors.push(strErr);
		    this.finalizeFailedLoadedVolume(this.m_volumeSet, this.m_fileName, arrErrors);
		  } else {
		    this.finalizeSuccessLoadedVolume(this.m_volumeSet, this.m_fileName);
		    this.callbackReadComplete(LoadResult.SUCCESS, null, 0, null);
		  }
	}
	loadFromUrl(strUrl) {
		  const fileTools = new FileTools();
		  const isValid = fileTools.isValidUrl(strUrl);
		  if (isValid) {
		    this.m_url = strUrl;
				
		    this.m_fileName = fileTools.getFileNameFromUrl(strUrl);
		    this.m_volumeSet = new VolumeSet();
		    this.m_volumeSet.addVolume(new Volume());
				
		    if (strUrl.endsWith('.ktx')) {
		      const callbackProgress = this.callbackReadProgress;
		      const callbackComplete = this.callbackReadCompleteUrlKtxNii;
		      this.callbackReadProgress(0.0);
		      this.m_volumeSet.readFromKtxUrl(strUrl, callbackProgress, callbackComplete);
		      // if KTX
		    } else if (strUrl.endsWith('.nii')) {
		      const callbackProgress = this.callbackReadProgress;
		      const callbackComplete = this.callbackReadCompleteUrlKtxNii;
		      this.callbackReadProgress(0.0);
		      this.m_volumeSet.readFromNiiUrl(strUrl, callbackProgress, callbackComplete);
		      // if NII (Nifti format)
		    } else if (strUrl.endsWith('.dcm')) {
		      const loaderUrlDcm = new LoaderDcmUrlDaikon();
		      return loaderUrlDcm.readFromUrl(this.m_volumeSet, strUrl, this.callbackReadCompleteUrlKtxNii, this.callbackReadProgress);
		    } else if (strUrl.endsWith('.h')) {
		      const callbackProgress = this.callbackReadProgress;
		      const callbackComplete = this.callbackReadCompleteUrlKtxNii;
		      this.callbackReadProgress(0.0);
		      this.m_volumeSet.readFromHdrUrl(strUrl, callbackProgress, callbackComplete);
		      // if Hdr
		    } else {
		      console.log(`UiOpenMenu. Unknow file type from URL = ${strUrl}`);
		    }
				
		    // if valid url
		  } else {
		    const strErr = `UiOpenMenu. Bad URL = ${strUrl}`;
		    console.log(strErr);
		    this.setErrorString(strErr);
		  }
	}
	onClickLoadUrl() {
		  this.setState({ showModalUrl: false });
		  const strUrl = this.state.strUrl;
		  console.log(`onClickLoadUrl with strUrl = ${strUrl}`);
		  this.loadFromUrl(strUrl);
	}
	onModalDemoOpenShow() {
		  this.setState({ showModalDemo: true });
	}
	onModalDemoOpenHide() {
		  this.setState({ showModalDemo: false });
	}
	arrNumToStr(arrNums) {
		  const numLet = arrNums.length;
		  let str = '';
		  for (let i = 0; i < numLet; i++) {
		    const n = arrNums[i];
		    str = str.concat(String.fromCharCode(n));
		  }
		  return str;
	}
	onModalGoogleShow() {
		  this.setState({ showModalGoogle: true });
	}
	onModalGoogleHide() {
		  this.setState({ showModalGoogle: false });
	}
	onGoogleSelected(index) {
		  // perform action on click i-th item in Google cloud menu . Or remove this menu completely
		  console.log(`onGoogleSelected(${index}) ... `);
	}
	onDemoSelected(index) {
		  return this.loadFromUrl([
		    'https://med3web.pqfotpvsdf.fqbn.dpn/nfe4xfc3131/31212219.luy',
		    'https://med3web.pqfotpvsdf.fqbn.dpn/nfe4xfc3131/tfu11.luy',
		    'https://med3web.pqfotpvsdf.fqbn.dpn/nfe4xfc3131/hn4_623_623_276.ojj',
		    'https://med3web.pqfotpvsdf.fqbn.dpn/nfe4xfc3131/xpnbo_qfmwjt/wig.:12.edn',
		    'https://med3web.pqfotpvsdf.fqbn.dpn/nfe4xfc3131/11dcb1:2gb5be73dd4311b768bfc:68f/145784245dcfg6fb26gg:f1d91:1611b.edn',
		    'https://med3web.pqfotpvsdf.fqbn.dpn/nfe4xfc3131/du_367_367_367.luy',
		    'https://med3web.pqfotpvsdf.fqbn.dpn/nfe4xfc3131/mvoht_367_367_367.luy',
		    'http://www.e-joufs.sv/qsjwbuf/nfe4xfc/ebub/ies/tfu_jouo.i'
		  ][index]);
	}
	onModalDicomSeriesHide() {
		  const arrEmpty = [];
		  const store = this.props;
		  store.dispatch({ type: StoreActionType.SET_DICOM_SERIES, dicomSeries: arrEmpty });
	}
	onDicomSerieSelected(indexSelected) {
		  const store = this.props;
		  const series = store.dicomSeries;
		  const serieSelected = series[indexSelected];
		  const hash = serieSelected.m_hash;
		  this.m_loader.createVolumeFromSlices(this.m_volumeSet, indexSelected, hash);
		  this.finalizeSuccessLoadedVolume(this.m_volumeSet, this.m_fileName);
		  console.log(`onFileContentReadMultipleDicom read all ${this.m_numFiles} files`);
			
		  // clear modal
		  store.dispatch({ type: StoreActionType.SET_DICOM_SERIES, dicomSeries: [] });
	}
	onModalWindowCWHide(needShow) {
		  this.setState({ showModalWindowCW: false });
		  if (needShow) {
		    this.finalizeSuccessLoadedVolume(this.m_volumeSet, this.m_fileName);
		    // setup dicom series (volumes info) for global store: select volume later
		    const store = this.props;
		    let series = null;
		    if (this.m_loader !== undefined) {
		      series = this.m_loader.m_slicesVolume.getSeries();
		      store.dispatch({ type: StoreActionType.SET_DICOM_SERIES, dicomSeries: series });
		    }
		    // update graphics 2d window
		    const gra = store.graphics2d;
		    if (gra !== null) {
		      gra.forceUpdate();
		    }
		  }
	}
	componentDidMount() {
		  this.m_fileSelector = this.buildFileSelector();
		  const fileNameOnLoad = this.m_fileNameOnLoad;
		  // console.log(`UiOpenMenu. componentDidMount. fnonl = ${fileNameOnLoad}`);
		  if ((fileNameOnLoad.length > 0) && (this.state.onLoadCounter > 0)) {
		    this.setState({ onLoadCounter: 0 });
		    const TIMEOUT_MS = 50;
		    setTimeout(this.loadFromUrl(fileNameOnLoad), TIMEOUT_MS);
		  }
	}
	render() {
		  // todo: get path from url
		  // todo: get from gDrive
		  // todo: get from Demo Set
		  // todo: get from Local Folder/File
		  // todo: style open file area
			
		  return <>
				<div className="open-file__area">
				  <div className="left" onClick={this.onButtonLocalFile}>
					  <OpenLocalFileIcon/>
				    <span className="filename">{this.m_fileName || 'file_name_displayed_here.dicom'}</span>
				  </div>
				  <div className="right">
					  <OpenLocalFolderIcon/>
					  <OpenLinkIcon/>
					  <OpenDemoIcon/>
				  </div>
				</div>
        <div className="save-file__area">
          <DownloadIcon />
          <GetFileIcon />
        </div>
			</>;
	}
}

export default connect(store => store)(UiOpenMenu);
