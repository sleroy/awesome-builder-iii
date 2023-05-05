<template>
  <a class="btn btn-primary z-0 ml-auto py-[14px] cursor-pointer" @click="action">
    {{ !isLoggedIn ? lbl_signin : lbl_signout }}
  </a>
</template>

<script lang="ts">
import { Auth } from "aws-amplify";
import { isSessionValid } from "../../auth/userPool";

interface Data {
  isLoggedIn: boolean;
}

export default {
  props: ["lbl_signin", "lbl_signout", "url_signin", "url_signout"],
  created() {},
  data(): Data {
    return {
      isLoggedIn: false,
    };
  },
  mounted() {
    isSessionValid().then((r) => this.isLoggedIn = r)
  },
  methods: {
    action: async function () {
      if (this.isLoggedIn) {
        await this.signOut()
        this.isLoggedIn = false;
        window.open(this.url_signout, "_self");
      } else {
        this.isLoggedIn = false;
        window.open(this.url_signin, "_self");
      }
    },
    signOut: async function () {
      try {
        await Auth.signOut({ global: true });
      } catch (error) {
        console.log('error signing out: ', error);
      } finally {
        window.open("/", "_self");
      }
    }
  },
};
</script>
