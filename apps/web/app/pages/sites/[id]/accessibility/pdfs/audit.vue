<script setup lang="ts">

const route = useRoute()

await navigateTo(`/sites/${route.params.id}/accessibility/pdfs`, { replace: true })

</script>

