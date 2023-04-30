<template>
  <div>
    <div v-bind="getRootProps()">
      <div class="flex w-full items-center justify-center" @click="open">
        <label
          for="dropzone-file"          
          class="dark:hover:bg-bray-800 flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600"
        >
          <div class="flex flex-col items-center justify-center pb-6 pt-5">
            <svg
              aria-hidden="true"
              class="mb-3 h-10 w-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
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
            v-bind="getInputProps()"
          />
          <p v-if="isDragActive">Drop the files here ...</p>
          <p v-else>Drag 'n' drop some files here, or click to select files</p>
        </label>
      </div>
    </div>
    <div class="flex w-full items-center justify-center mt-6">
      <button class="btn btn-primary" @click="upload" >Open an file</button>
    </div>
  </div>
</template>
<script lang="ts">
import { useDropzone } from "vue3-dropzone";
import { Auth, Storage } from 'aws-amplify';
import { reactive } from "vue";

export default {
  name: "VideoUploadForm",
  setup() {
    const state = reactive({accepted:[] as any[]});
    function onDrop(acceptFiles:any[], rejectReasons: any[]) {
      console.log("Accepted", acceptFiles);
      console.log("Rejected ", rejectReasons);
      state.accepted = (acceptFiles);
    }

    const { getRootProps, getInputProps, ...rest } = useDropzone({
      onDrop,
      accept: ["video/*"],
      multiple: true,
    });
  
    const upload = async () => {
      console.log("Upload")
      const file : File = state.accepted[0];
      try {
        await Storage.put(file.name, file, {
          contentType: "video/mp4", // contentType is optional
        });
      } catch (error) {
        console.log("Error uploading file: ", error);
      }
    }

    return {
      getRootProps,
      getInputProps,
      ...rest,
      upload,
      state
    };
  }
};
</script>
