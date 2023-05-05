<template>
  <div>
    <div v-bind="getRootProps()" class="mt-6">
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert"
      v-if="successMsg">
      {{ successMsg }}
    </div>    
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert" v-if="errorMsg">
      {{ errorMsg }}
    </div>
      <div class="flex w-full items-center justify-center cursor-pointer" @click="open" >
        <label for="dropzone-file"
          class="dark:hover:bg-bray-800 flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600">
          <div class="flex flex-col items-center justify-center pb-6 pt-5">
            <svg aria-hidden="true" class="mb-3 h-10 w-10 text-gray-400" fill="none" stroke="currentColor"
              viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
              <span class="font-semibold">Click to upload</span> or drag and
              drop
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              SVG, PNG, JPG or GIF (MAX. 800x400px)
            </p>
          </div>
          <input
            class="block w-full cursor-pointer rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:placeholder-gray-400"
            v-bind="getInputProps()" />
          <p v-if="isDragActive">Drop the files here ...</p>
          <p v-else>Drag 'n' drop some files here, or click to select files</p>
        </label>
      </div>
    </div>
    <div class="bg-blue-100 border border-blue-400  p-4 rounded relative" role="info" v-if="acceptedFiles.length > 0">
      <h3 class="text-base">Selected files : </h3>
      <ul v-for="(file, index) in acceptedFiles" class="mt-2">
        <li class="ml-4 list-disc" :key="file.name"><a href="#delete" @click="remove(index)">{{ file.name }}</a></li>
      </ul>
    </div>

    <div class="flex w-full items-center justify-center mt-6">
      <button
        class="flex justify-center items-center select-none border-2 text-white text-xl font-bold p-4 m-2 rounded-full cursor-pointer shadow focus:outline-none focus:shadow-outline" :class="{'bg-primary': hasFile, 'bg-gray-400' : !hasFile, 'hover:p-6': hasFile }"
        @click="upload" :disabled="state.progress || (!hasFile)">
        <svg aria-hidden="true" class="w-7 h-7 mr-2 text-gray-200 animate-spin dark:text-gray-600 fill-red-600"
          viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg" v-if="state.progress">
          <path
            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
            fill="currentColor" />
          <path
            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
            fill="currentFill" />
        </svg>
        <span class="">{{ state.progress ? `Upload in progress - ${state.progressMessage}` : "Upload selected files" }}</span>
      </button>
    </div>
  </div>
</template>
<script lang="ts">
import { useDropzone } from "vue3-dropzone";
import { reactive, ref, computed } from "vue";
import credentials from '../../credentials.json'
import { Storage, Auth } from "aws-amplify";

export default {
  name: "VideoUploadForm",
  setup() {
    // isSessionValid().then((r) => { if (!r) window.open("/", "_self")})
    const state = reactive({
      accepted: [] as any[],
      progress: false,
      progressMessage: "",
    });
    const errorMsg = ref<null | any>(null)
    const successMsg = ref<string | null>(null)
    const hasFile =  computed(() => state.accepted.length > 0);

    const progressCallback = (progress: any) => {
      state.progressMessage = Math.round(
        (progress.loaded / progress.total) * 100
      )+ "%";
    };

    function onDrop(acceptFiles: any[], rejectReasons: any[]) {
      if (rejectReasons.length > 0) {
        errorMsg.value = "Files are rejected " + rejectReasons
      }
      state.accepted = (acceptFiles);
    }

    const { getRootProps, getInputProps, ...rest } = useDropzone({
      onDrop,
      accept: ["video/*"],
      multiple: true,
    });

    const upload = async () => {
      const file: File = state.accepted[0];
      state.progress = true;
      errorMsg.value = null;
      successMsg.value = null;
      try {
        const userInfo = await Auth.currentUserInfo()
        //console.log("Profile", userInfo.attributes)
        const profileName = userInfo.attributes.profile;
        const bucket = profileName === 'gold' ? credentials.storage.hightier_bucket : credentials.storage.lowtier_bucket;
        const upload = await Storage.put(file.name, file, {
          level: "private",
          bucket: bucket,
          progressCallback: progressCallback,
          tagging: 'profile=' + profileName + "&customer=" + userInfo.id,
        })
        successMsg.value = "Video uploaded with success"
        state.accepted = []

      } catch (error) {
        errorMsg.value = error;
        console.error("Error uploading file: ", error);
      } finally {
        state.progress = false;
      }
    }

    const remove = (i: number) => {
      state.accepted = state.accepted.splice(i, 1)
    }

    return {
      getRootProps,
      getInputProps,
      ...rest,
      remove,
      upload,
      hasFile,
      errorMsg,
      successMsg,
      state
    };
  }
};
</script>
