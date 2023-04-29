<template>
    <form class="" action="#" method="POST">
      <div class="flex items-center justify-center w-full mt-6">
      <label for="dropzone-file" class="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
          <div class="flex flex-col items-center justify-center pt-5 pb-6"  @drop.prevent="onDrop" :data-active="active" @dragenter.prevent="setActive" @dragover.prevent="setActive" @dragleave.prevent="setInactive" >
              <svg aria-hidden="true" class="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <p class="mb-2 text-sm text-gray-500 dark:text-gray-400"><span class="font-semibold">Click to upload</span> or drag and drop</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">SVG, PNG, JPG or GIF (MAX. 800x400px)</p>
          </div>
          <input id="dropzone-file" type="file" class="hidden" />
      </label>
    </div>
    <div class="flex items-center justify-center w-full mt-6">
          <button type="submit" @click.prevent="uploadVideo" @submit.prevent="uploadVideo" class="flex justify-center w-full p-4 my-5 font-semibold tracking-wide text-gray-100 transition duration-300 ease-in bg-blue-500 rounded-full shadow-lg cursor-pointer focus:outline-none focus:shadow-outline hover:bg-blue-600">
            Upload
          </button>
        </div>

  </form>
</template>
<script lang="ts">
import * as AmazonCognitoIdentity from "amazon-cognito-identity-js";
import { userPool, isSessionValid } from '../../auth/userPool';
import { Amplify, Auth, Storage } from 'aws-amplify';

const events = ['dragenter', 'dragover', 'dragleave', 'drop']
function preventDefaults(e: Event) {
  e.preventDefault()
}

export default {
  setup() { },
  data() {
    return {
      active: false
    };
  },
  computed: {
    userData() {

    }
  },
  mounted() {
    events.forEach((eventName) => {
      document.body.addEventListener(eventName, preventDefaults)
    })
    /**
    Amplify.configure({
      Auth: {
        identityPoolId:
        region: 'us-east-1', // REQUIRED - Amazon Cognito Region

      },
      Storage: {
        AWSS3: {
          bucket: 'video-upload-bucket', //REQUIRED -  Amazon S3 bucket name
          region: 'us-east-1', //OPTIONAL -  Amazon service region
        }
      }
    });
     */
  },
  unmounted() {
    events.forEach((eventName) => {
      document.body.removeEventListener(eventName, preventDefaults)
    })
  },
  methods: {
    onDrop: function (e: DragEvent) {
      this.setInactive() // add this line too
      if (e.dataTransfer) {
        const files = [...e.dataTransfer.files];
        console.log("Files", files)
      }
    },
    uploadVideo() {
      console.log("Upload video")
      var s3 = new AWS.S3({
        apiVersion: "2006-03-01",
        params: { Bucket: albumBucketName }
      });

    },
    setActive: function () {
      this.active = true
    },
    setInactive: function () {
      this.active = false
    }
  },
};
</script>

