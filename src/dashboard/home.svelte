<script>
    const { hello } = $props()
    let count = $state(0)
</script>

<h1>hellowo {hello}</h1>
<button onclick={() => {count++}}>{count}</button>

<style>
    button {
        color: red;
    }
</style>
